"""Repositorio SQL (SQLite) para gerir o inventario."""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
import re
import sqlite3
from threading import RLock
from typing import Dict, List, Optional
import unicodedata
from uuid import uuid4

from openpyxl import Workbook
from app.core.config import LEGACY_EXCEL_PATH, LEGACY_EXCEL_SHEET_NAME, SQLITE_DB_PATH
from app.schemas import ColunaSchema, Peca, PecaCreate, PecaUpdate


class ExcelRepository:
    """
    Repositorio principal do inventario.

    Nota: o nome da classe foi mantido para evitar mexidas adicionais no resto da app.
    A persistencia agora e feita em SQLite.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._core_keys = {"referencia", "categoria", "marca", "designacao", "quantidade", "local", "id"}
        self._core_columns = [
            ColunaSchema(chave="referencia", nome="Referência", removivel=False),
            ColunaSchema(chave="categoria", nome="Categoria", removivel=False),
            ColunaSchema(chave="marca", nome="Marca", removivel=False),
            ColunaSchema(chave="designacao", nome="Designação", removivel=False),
            ColunaSchema(chave="quantidade", nome="Quantidade", removivel=False),
            ColunaSchema(chave="local", nome="Local", removivel=False),
        ]

        self._validar_caminho_bd()
        self._inicializar_schema()
        self._migrar_excel_legacy_se_necessario()

    def listar(self, termo: Optional[str] = None) -> List[Peca]:
        """Lista pecas com filtro opcional por texto."""
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, referencia, categoria, marca, designacao, quantidade, local, extras
                FROM pecas
                ORDER BY LOWER(designacao), LOWER(referencia)
                """
            ).fetchall()

            pecas = [self._row_to_peca(row) for row in rows]
            if not termo:
                return pecas

            termo_normalizado = termo.strip().lower()
            return [peca for peca in pecas if self._match_termo(peca, termo_normalizado)]

    def obter_por_id(self, peca_id: str) -> Optional[Peca]:
        """Procura uma peca pelo ID."""
        with self._lock, self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, referencia, categoria, marca, designacao, quantidade, local, extras
                FROM pecas
                WHERE id = ?
                """,
                (peca_id,),
            ).fetchone()

            return self._row_to_peca(row) if row else None

    def criar(self, payload: PecaCreate) -> Peca:
        """Cria uma nova peca."""
        with self._lock, self._connect() as conn:
            peca_id = str(uuid4())
            extras_validos = self._filtrar_extras_validos(conn, payload.extras)

            conn.execute(
                """
                INSERT INTO pecas (id, referencia, categoria, marca, designacao, quantidade, local, extras)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    peca_id,
                    payload.referencia,
                    payload.categoria,
                    payload.marca,
                    payload.designacao,
                    payload.quantidade,
                    payload.local,
                    json.dumps(extras_validos, ensure_ascii=False),
                ),
            )
            conn.commit()

            return Peca(
                id=peca_id,
                referencia=payload.referencia,
                categoria=payload.categoria,
                marca=payload.marca,
                designacao=payload.designacao,
                quantidade=payload.quantidade,
                local=payload.local,
                extras=extras_validos,
            )

    def atualizar(self, peca_id: str, payload: PecaUpdate) -> Optional[Peca]:
        """Atualiza todos os campos de uma peca."""
        with self._lock, self._connect() as conn:
            existe = conn.execute("SELECT id FROM pecas WHERE id = ?", (peca_id,)).fetchone()
            if not existe:
                return None

            extras_validos = self._filtrar_extras_validos(conn, payload.extras)
            conn.execute(
                """
                UPDATE pecas
                SET referencia = ?,
                    categoria = ?,
                    marca = ?,
                    designacao = ?,
                    quantidade = ?,
                    local = ?,
                    extras = ?
                WHERE id = ?
                """,
                (
                    payload.referencia,
                    payload.categoria,
                    payload.marca,
                    payload.designacao,
                    payload.quantidade,
                    payload.local,
                    json.dumps(extras_validos, ensure_ascii=False),
                    peca_id,
                ),
            )
            conn.commit()

            return Peca(
                id=peca_id,
                referencia=payload.referencia,
                categoria=payload.categoria,
                marca=payload.marca,
                designacao=payload.designacao,
                quantidade=payload.quantidade,
                local=payload.local,
                extras=extras_validos,
            )

    def atualizar_quantidade(self, peca_id: str, nova_quantidade: int) -> Optional[Peca]:
        """Atualiza apenas a quantidade de uma peca."""
        with self._lock, self._connect() as conn:
            updated = conn.execute(
                "UPDATE pecas SET quantidade = ? WHERE id = ?",
                (max(0, nova_quantidade), peca_id),
            )
            conn.commit()
            if updated.rowcount == 0:
                return None

            row = conn.execute(
                """
                SELECT id, referencia, categoria, marca, designacao, quantidade, local, extras
                FROM pecas
                WHERE id = ?
                """,
                (peca_id,),
            ).fetchone()
            return self._row_to_peca(row) if row else None

    def eliminar(self, peca_id: str) -> bool:
        """Elimina uma peca pelo ID."""
        with self._lock, self._connect() as conn:
            deleted = conn.execute("DELETE FROM pecas WHERE id = ?", (peca_id,))
            conn.commit()
            return deleted.rowcount > 0

    def obter_colunas(self) -> List[ColunaSchema]:
        """Lista colunas visiveis no schema."""
        with self._lock, self._connect() as conn:
            core_names_rows = conn.execute(
                """
                SELECT chave, nome
                FROM schema_core_nomes
                """
            ).fetchall()
            core_name_map = {row["chave"]: row["nome"] for row in core_names_rows}

            colunas_core = [
                ColunaSchema(
                    chave=coluna.chave,
                    nome=core_name_map.get(coluna.chave, coluna.nome),
                    removivel=coluna.removivel,
                )
                for coluna in self._core_columns
            ]

            rows = conn.execute(
                """
                SELECT chave, nome
                FROM schema_colunas
                ORDER BY posicao ASC
                """
            ).fetchall()
            dinamicas = [ColunaSchema(chave=row["chave"], nome=row["nome"], removivel=True) for row in rows]
            todas = [*colunas_core, *dinamicas]

            ordem_rows = conn.execute(
                """
                SELECT chave, posicao
                FROM schema_ordem_colunas
                ORDER BY posicao ASC
                """
            ).fetchall()
            ordem = {row["chave"]: int(row["posicao"]) for row in ordem_rows}
            todas.sort(key=lambda coluna: ordem.get(coluna.chave, 9999))
            return todas

    def adicionar_coluna(self, nome: str) -> ColunaSchema:
        """Adiciona uma nova coluna dinamica."""
        with self._lock, self._connect() as conn:
            nome_limpo = nome.strip()
            chave = self._normalizar_chave_coluna(nome_limpo)
            if not chave:
                raise ValueError("O nome da coluna nao e valido.")
            if chave in self._core_keys:
                raise ValueError("Nao e permitido criar coluna com nome repetido.")

            existente = conn.execute("SELECT 1 FROM schema_colunas WHERE chave = ?", (chave,)).fetchone()
            if existente:
                raise ValueError("Ja existe uma coluna com esse nome.")

            posicao_row = conn.execute("SELECT COALESCE(MAX(posicao), 0) AS max_pos FROM schema_colunas").fetchone()
            posicao = int(posicao_row["max_pos"]) + 1

            conn.execute(
                "INSERT INTO schema_colunas (chave, nome, posicao) VALUES (?, ?, ?)",
                (chave, nome_limpo, posicao),
            )
            proxima_pos = conn.execute(
                "SELECT COALESCE(MAX(posicao), 0) AS max_pos FROM schema_ordem_colunas"
            ).fetchone()
            conn.execute(
                "INSERT OR REPLACE INTO schema_ordem_colunas (chave, posicao) VALUES (?, ?)",
                (chave, int(proxima_pos["max_pos"]) + 1),
            )
            conn.commit()
            return ColunaSchema(chave=chave, nome=nome_limpo, removivel=True)

    def remover_coluna(self, chave: str) -> bool:
        """Remove uma coluna dinamica e limpa os dados antigos em extras."""
        with self._lock, self._connect() as conn:
            chave_normalizada = self._normalizar_chave_coluna(chave)
            if not chave_normalizada:
                return False
            if chave_normalizada in self._core_keys:
                raise ValueError("Nao e permitido remover colunas base do sistema.")

            existente = conn.execute("SELECT 1 FROM schema_colunas WHERE chave = ?", (chave_normalizada,)).fetchone()
            if not existente:
                return False

            conn.execute("DELETE FROM schema_colunas WHERE chave = ?", (chave_normalizada,))
            conn.execute("DELETE FROM schema_ordem_colunas WHERE chave = ?", (chave_normalizada,))

            rows = conn.execute("SELECT id, extras FROM pecas").fetchall()
            for row in rows:
                extras = self._parse_extras(row["extras"])
                if chave_normalizada not in extras:
                    continue
                extras.pop(chave_normalizada, None)
                conn.execute(
                    "UPDATE pecas SET extras = ? WHERE id = ?",
                    (json.dumps(extras, ensure_ascii=False), row["id"]),
                )

            conn.commit()
            return True

    def renomear_coluna(self, chave: str, novo_nome: str) -> Optional[ColunaSchema]:
        """Renomeia uma coluna base ou dinamica."""
        with self._lock, self._connect() as conn:
            chave_normalizada = self._normalizar_chave_coluna(chave)
            nome_limpo = novo_nome.strip()
            if not chave_normalizada or not nome_limpo:
                return None

            if chave_normalizada in self._core_keys:
                if chave_normalizada == "id":
                    return None

                updated = conn.execute(
                    "UPDATE schema_core_nomes SET nome = ? WHERE chave = ?",
                    (nome_limpo, chave_normalizada),
                )
                conn.commit()
                if updated.rowcount == 0:
                    return None
                return ColunaSchema(chave=chave_normalizada, nome=nome_limpo, removivel=False)

            updated = conn.execute(
                "UPDATE schema_colunas SET nome = ? WHERE chave = ?",
                (nome_limpo, chave_normalizada),
            )
            conn.commit()
            if updated.rowcount == 0:
                return None
            return ColunaSchema(chave=chave_normalizada, nome=nome_limpo, removivel=True)

    def reordenar_colunas(self, chaves: List[str]) -> List[ColunaSchema]:
        """Atualiza a ordem das colunas visiveis e devolve o schema final."""
        with self._lock, self._connect() as conn:
            atuais = self.obter_colunas()
            chaves_atuais = [coluna.chave for coluna in atuais]
            chaves_requisicao = [self._normalizar_chave_coluna(chave) for chave in chaves]

            if set(chaves_requisicao) != set(chaves_atuais):
                raise ValueError("A ordem enviada deve conter exatamente as colunas atuais.")

            for posicao, chave in enumerate(chaves_requisicao, start=1):
                conn.execute(
                    """
                    INSERT INTO schema_ordem_colunas (chave, posicao)
                    VALUES (?, ?)
                    ON CONFLICT(chave) DO UPDATE SET posicao = excluded.posicao
                    """,
                    (chave, posicao),
                )
            conn.commit()
            return self.obter_colunas()

    def exportar_para_excel(self) -> bytes:
        """Exporta o estado atual da base de dados para ficheiro Excel em memoria."""
        colunas = self.obter_colunas()
        pecas = self.listar()

        wb = Workbook()
        ws = wb.active
        ws.title = "Inventario"

        # Header
        ws.append([coluna.nome for coluna in colunas])

        for peca in pecas:
            linha = []
            for coluna in colunas:
                if coluna.chave in self._core_keys:
                    linha.append(getattr(peca, coluna.chave, None))
                else:
                    linha.append(peca.extras.get(coluna.chave))
            ws.append(linha)

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    def _connect(self) -> sqlite3.Connection:
        """Cria conexao SQLite com row factory em dicionario."""
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _validar_caminho_bd(self) -> None:
        """Garante que a pasta da base de dados existe."""
        Path(SQLITE_DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    def _inicializar_schema(self) -> None:
        """Cria tabelas base se necessario."""
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pecas (
                    id TEXT PRIMARY KEY,
                    referencia TEXT NOT NULL,
                    categoria TEXT NOT NULL,
                    marca TEXT NOT NULL,
                    designacao TEXT NOT NULL,
                    quantidade INTEGER NOT NULL DEFAULT 0,
                    local TEXT,
                    extras TEXT NOT NULL DEFAULT '{}'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_colunas (
                    chave TEXT PRIMARY KEY,
                    nome TEXT NOT NULL,
                    posicao INTEGER NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_core_nomes (
                    chave TEXT PRIMARY KEY,
                    nome TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_ordem_colunas (
                    chave TEXT PRIMARY KEY,
                    posicao INTEGER NOT NULL
                )
                """
            )

            for coluna in self._core_columns:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO schema_core_nomes (chave, nome)
                    VALUES (?, ?)
                    """,
                    (coluna.chave, coluna.nome),
                )

            ordem_existente = conn.execute("SELECT COUNT(*) AS total FROM schema_ordem_colunas").fetchone()
            if int(ordem_existente["total"]) == 0:
                posicao = 1
                for coluna in self._core_columns:
                    conn.execute(
                        "INSERT INTO schema_ordem_colunas (chave, posicao) VALUES (?, ?)",
                        (coluna.chave, posicao),
                    )
                    posicao += 1

                dinamicas = conn.execute(
                    "SELECT chave FROM schema_colunas ORDER BY posicao ASC"
                ).fetchall()
                for row in dinamicas:
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_ordem_colunas (chave, posicao) VALUES (?, ?)",
                        (row["chave"], posicao),
                    )
                    posicao += 1

            posicao_max = conn.execute("SELECT COALESCE(MAX(posicao), 0) AS max_pos FROM schema_ordem_colunas").fetchone()
            proxima_pos = int(posicao_max["max_pos"]) + 1
            chaves_ordenadas = {
                row["chave"] for row in conn.execute("SELECT chave FROM schema_ordem_colunas").fetchall()
            }
            chaves_atuais = [coluna.chave for coluna in self._core_columns]
            chaves_atuais.extend(
                row["chave"] for row in conn.execute("SELECT chave FROM schema_colunas ORDER BY posicao ASC").fetchall()
            )
            for chave in chaves_atuais:
                if chave in chaves_ordenadas:
                    continue
                conn.execute(
                    "INSERT INTO schema_ordem_colunas (chave, posicao) VALUES (?, ?)",
                    (chave, proxima_pos),
                )
                proxima_pos += 1
            conn.commit()

    def _migrar_excel_legacy_se_necessario(self) -> None:
        """
        Migra os dados do Excel antigo para SQLite uma unica vez.

        A migracao ocorre apenas se:
        - o ficheiro legacy existir
        - a tabela SQL estiver vazia
        """
        with self._lock, self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) AS total FROM pecas").fetchone()["total"]
            if total > 0:
                return

        if not Path(LEGACY_EXCEL_PATH).exists():
            return

        try:
            from openpyxl import load_workbook
        except Exception:
            # Sem openpyxl nao ha migracao automatica.
            return

        wb = load_workbook(LEGACY_EXCEL_PATH)
        sheet = wb[LEGACY_EXCEL_SHEET_NAME] if LEGACY_EXCEL_SHEET_NAME in wb.sheetnames else wb[wb.sheetnames[0]]
        headers = [sheet.cell(row=1, column=idx).value for idx in range(1, sheet.max_column + 1)]

        key_map: Dict[int, str] = {}
        custom_headers: List[tuple[str, str]] = []
        for idx, header in enumerate(headers, start=1):
            nome = str(header or "").strip()
            if not nome:
                continue

            normalized = self._normalizar_chave_coluna(nome)
            if normalized in self._core_keys:
                key_map[idx] = normalized
                continue

            aliases = {
                "referencia": {"referencia", "ref"},
                "designacao": {"designacao"},
            }
            encontrado = None
            norm_no_accents = self._normalizar_texto(nome)
            for core_key, options in aliases.items():
                if norm_no_accents in options:
                    encontrado = core_key
                    break

            if encontrado and encontrado not in key_map.values():
                key_map[idx] = encontrado
                continue

            if not normalized:
                continue
            unique_key = normalized
            suffix = 2
            while unique_key in self._core_keys or any(existing[0] == unique_key for existing in custom_headers):
                unique_key = f"{normalized}_{suffix}"
                suffix += 1

            key_map[idx] = unique_key
            custom_headers.append((unique_key, nome))

        required = {"referencia", "categoria", "marca", "designacao", "quantidade"}
        if not required.issubset(set(key_map.values())):
            return

        with self._lock, self._connect() as conn:
            # Colunas dinamicas.
            pos = 1
            for key, nome in custom_headers:
                conn.execute(
                    "INSERT OR IGNORE INTO schema_colunas (chave, nome, posicao) VALUES (?, ?, ?)",
                    (key, nome, pos),
                )
                pos += 1

            # Linhas.
            for row_idx in range(2, sheet.max_row + 1):
                linha = {key_map[col]: sheet.cell(row=row_idx, column=col).value for col in key_map}
                referencia = str(linha.get("referencia") or "").strip()
                categoria = str(linha.get("categoria") or "").strip()
                marca = str(linha.get("marca") or "").strip()
                designacao = str(linha.get("designacao") or "").strip()
                if not all([referencia, categoria, marca, designacao]):
                    continue

                quantidade = self._safe_int(linha.get("quantidade"))
                local_raw = linha.get("local")
                local = str(local_raw).strip() if local_raw is not None and str(local_raw).strip() else None
                peca_id = str(linha.get("id") or "").strip() or str(uuid4())

                extras = {}
                for key, _nome in custom_headers:
                    valor = linha.get(key)
                    if valor is None:
                        continue
                    if isinstance(valor, str):
                        valor = valor.strip()
                        if not valor:
                            continue
                    extras[key] = valor

                conn.execute(
                    """
                    INSERT OR REPLACE INTO pecas (id, referencia, categoria, marca, designacao, quantidade, local, extras)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        peca_id,
                        referencia,
                        categoria,
                        marca,
                        designacao,
                        max(0, quantidade),
                        local,
                        json.dumps(extras, ensure_ascii=False),
                    ),
                )

            conn.commit()

    def _filtrar_extras_validos(self, conn: sqlite3.Connection, extras: dict[str, object]) -> dict[str, object]:
        """Mantem apenas extras que existem no schema dinamico."""
        allowed = {
            row["chave"]
            for row in conn.execute("SELECT chave FROM schema_colunas").fetchall()
        }

        cleaned: dict[str, object] = {}
        for key, value in (extras or {}).items():
            key_norm = self._normalizar_chave_coluna(key)
            if key_norm not in allowed:
                continue
            if value is None:
                continue
            if isinstance(value, str):
                text = value.strip()
                if not text:
                    continue
                cleaned[key_norm] = text
                continue
            cleaned[key_norm] = value
        return cleaned

    def _row_to_peca(self, row: sqlite3.Row) -> Peca:
        """Converte linha SQL para modelo Pydantic."""
        return Peca(
            id=row["id"],
            referencia=row["referencia"],
            categoria=row["categoria"],
            marca=row["marca"],
            designacao=row["designacao"],
            quantidade=max(0, int(row["quantidade"])),
            local=row["local"],
            extras=self._parse_extras(row["extras"]),
        )

    @staticmethod
    def _parse_extras(raw: object) -> dict[str, object]:
        """Converte JSON de extras em dicionario."""
        if raw is None:
            return {}
        if isinstance(raw, dict):
            return raw
        try:
            parsed = json.loads(str(raw))
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    def _normalizar_chave_coluna(self, value: str) -> str:
        """Transforma nome em chave segura."""
        normalized = self._normalizar_texto(value)
        return re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")

    @staticmethod
    def _normalizar_texto(value: object) -> str:
        """Remove acentos e normaliza caixa."""
        raw = str(value or "").strip().lower()
        return "".join(char for char in unicodedata.normalize("NFD", raw) if unicodedata.category(char) != "Mn")

    @staticmethod
    def _safe_int(value: object) -> int:
        """Converte para inteiro de forma robusta."""
        if value is None:
            return 0
        try:
            return int(float(str(value)))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _match_termo(peca: Peca, termo: str) -> bool:
        """Filtro textual para pesquisa."""
        extras_texto = " ".join(str(valor) for valor in peca.extras.values() if valor is not None)
        conjunto = " ".join(
            [
                peca.referencia,
                peca.categoria,
                peca.marca,
                peca.designacao,
                str(peca.quantidade),
                peca.local or "",
                peca.id,
                extras_texto,
            ]
        ).lower()
        return termo in conjunto
