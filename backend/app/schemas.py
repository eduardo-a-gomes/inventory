"""Esquemas Pydantic para validacao de entradas e saidas da API."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional
from typing import Union

from pydantic import BaseModel, Field, field_validator, model_validator

ValorExtra = Union[str, int, float, bool, None]
MAX_TEXTO_MATERIAL = 2048


class PecaBase(BaseModel):
    """Campos base de uma peca no inventario."""

    referencia: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    categoria: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    marca: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    designacao: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    preco: float = Field(default=0, ge=0, description="Preco unitario em euros.")
    quantidade: int = Field(default=0, ge=0, description="Quantidade atual em stock.")
    local: Optional[str] = Field(
        default=None,
        max_length=MAX_TEXTO_MATERIAL,
        description="Localizacao da peca na oficina (ex: 2-B).",
    )
    extras: dict[str, ValorExtra] = Field(
        default_factory=dict,
        description="Campos dinamicos definidos no schema da tabela.",
    )

    @field_validator("referencia", "categoria", "marca", "designacao", mode="before")
    @classmethod
    def limpar_textos(cls, value: object) -> str:
        """Normaliza campos de texto, permitindo vazio."""
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("local", mode="before")
    @classmethod
    def limpar_local(cls, value: object) -> Optional[str]:
        """Normaliza o campo opcional de localizacao."""
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("preco", mode="before")
    @classmethod
    def validar_preco(cls, value: object) -> float:
        """Aceita apenas numeros positivos com ate duas casas decimais."""
        if value is None or value == "":
            return 0

        texto = str(value).strip().replace(",", ".")
        try:
            decimal = Decimal(texto)
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("O preco tem de ser um numero.") from exc

        if decimal < 0:
            raise ValueError("O preco nao pode ser negativo.")
        if decimal.as_tuple().exponent < -2:
            raise ValueError("O preco so pode ter ate 2 casas decimais.")

        return float(decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    @field_validator("extras", mode="before")
    @classmethod
    def normalizar_extras(cls, value) -> dict[str, ValorExtra]:
        """Valida e normaliza os campos extra dinamicos."""
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("O campo 'extras' deve ser um objeto.")

        normalized: dict[str, ValorExtra] = {}
        for key, item in value.items():
            key_str = str(key).strip()
            if not key_str:
                continue
            normalized[key_str] = item
        return normalized

    @staticmethod
    def _valor_tem_conteudo(value: ValorExtra) -> bool:
        """Determina se um valor foi efetivamente preenchido."""
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        return True


class PecaCreate(PecaBase):
    """Payload para criar uma peca."""

    @model_validator(mode="after")
    def validar_minimo_um_campo(self) -> "PecaCreate":
        """Garante que pelo menos um campo foi preenchido."""
        textos_tem_conteudo = any(
            [
                bool(self.referencia),
                bool(self.categoria),
                bool(self.marca),
                bool(self.designacao),
                bool(self.local),
            ]
        )
        preco_tem_conteudo = self.preco > 0
        quantidade_tem_conteudo = self.quantidade > 0
        extras_tem_conteudo = any(self._valor_tem_conteudo(valor) for valor in self.extras.values())

        if not any([textos_tem_conteudo, preco_tem_conteudo, quantidade_tem_conteudo, extras_tem_conteudo]):
            raise ValueError("Preencha pelo menos um campo para criar o material.")
        return self


class PecaUpdate(PecaBase):
    """Payload para atualizar todos os campos de uma peca."""


class Peca(PecaBase):
    """Representacao completa de uma peca, incluindo ID interno."""

    id: str = Field(..., min_length=1)


class AtualizarQuantidadePayload(BaseModel):
    """Payload para atualizar apenas a quantidade."""

    quantidade: int = Field(..., ge=0, description="Novo valor absoluto de quantidade.")


class RegistarVendaPayload(BaseModel):
    """Payload para registar a venda de uma ou mais unidades."""

    quantidade: int = Field(default=1, ge=1, description="Quantidade vendida.")
    preco_unitario: float = Field(..., ge=0, description="Preco unitario real da venda.")


class AtualizarVendaHistoricoPayload(BaseModel):
    """Payload para editar um registo de venda existente."""

    quantidade_vendida: int = Field(..., ge=1, description="Nova quantidade vendida.")
    preco_unitario: float = Field(..., ge=0, description="Novo preco unitario da venda.")


class RegistoVendaResultado(BaseModel):
    """Resposta apos registar uma venda."""

    removida_do_inventario: bool
    quantidade_restante: int = Field(ge=0)
    peca: Optional["Peca"] = None


class ColunaSchema(BaseModel):
    """Representa uma coluna do schema atual."""

    chave: str = Field(..., min_length=1)
    nome: str = Field(..., min_length=1)
    removivel: bool = Field(default=True, description="Compatibilidade com versoes anteriores da UI.")


class AdicionarColunaPayload(BaseModel):
    """Payload para adicionar uma coluna ao schema."""

    nome: str = Field(..., min_length=1, max_length=80)

    @field_validator("nome")
    @classmethod
    def limpar_nome(cls, value: str) -> str:
        """Limpa espacos do nome da coluna."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("O nome da coluna e obrigatorio.")
        return cleaned


class RenomearColunaPayload(BaseModel):
    """Payload para renomear uma coluna existente."""

    nome: str = Field(..., min_length=1, max_length=80)

    @field_validator("nome")
    @classmethod
    def limpar_nome(cls, value: str) -> str:
        """Limpa espacos do nome da coluna."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("O nome da coluna e obrigatorio.")
        return cleaned


class ReordenarColunasPayload(BaseModel):
    """Payload com a ordem final das colunas visiveis."""

    chaves: list[str] = Field(..., min_length=1)

    @field_validator("chaves", mode="before")
    @classmethod
    def validar_lista(cls, value: object) -> list[str]:
        """Normaliza e valida a lista de chaves."""
        if not isinstance(value, list):
            raise ValueError("O campo 'chaves' deve ser uma lista.")

        resultado: list[str] = []
        vistos: set[str] = set()
        for item in value:
            chave = str(item or "").strip()
            if not chave:
                continue
            if chave in vistos:
                raise ValueError("A lista de chaves nao pode conter duplicados.")
            vistos.add(chave)
            resultado.append(chave)

        if not resultado:
            raise ValueError("Indica a ordem das colunas.")
        return resultado


class VendaHistoricoItem(BaseModel):
    """Linha do historico de materiais vendidos."""

    id: str = Field(..., min_length=1)
    peca_id: Optional[str] = None
    referencia: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    categoria: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    marca: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    designacao: str = Field(default="", max_length=MAX_TEXTO_MATERIAL)
    local: Optional[str] = Field(default=None, max_length=MAX_TEXTO_MATERIAL)
    preco_unitario: float = Field(default=0, ge=0)
    quantidade_vendida: int = Field(default=1, ge=1)
    total_venda: float = Field(default=0, ge=0)
    vendida_em: datetime
    extras: dict[str, ValorExtra] = Field(default_factory=dict)


class DashboardSerieValor(BaseModel):
    """Ponto simples para graficos do dashboard."""

    etiqueta: str = Field(..., min_length=1)
    valor: float = Field(default=0, ge=0)


class DashboardResumoVendas(BaseModel):
    """Resumo principal do dashboard de vendas."""

    faturacao_total: float = Field(default=0, ge=0)
    valor_em_stock: float = Field(default=0, ge=0)
    total_vendas: int = Field(default=0, ge=0)
    unidades_vendidas: int = Field(default=0, ge=0)
    unidades_em_stock: int = Field(default=0, ge=0)


class DashboardVendas(BaseModel):
    """Dados completos do dashboard de vendas."""

    resumo: DashboardResumoVendas
    faturacao_por_mes: list[DashboardSerieValor] = Field(default_factory=list)
    valor_stock_por_categoria: list[DashboardSerieValor] = Field(default_factory=list)
    faturacao_por_material: list[DashboardSerieValor] = Field(default_factory=list)
    historico: list[VendaHistoricoItem] = Field(default_factory=list)


class PreferenciaTemaFundo(BaseModel):
    """Preferencia persistente para o tema de fundo da aplicacao."""

    tema: str = Field(..., min_length=1, max_length=120)

    @field_validator("tema")
    @classmethod
    def limpar_tema(cls, value: str) -> str:
        """Normaliza o identificador do tema."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("O tema de fundo e obrigatorio.")
        return cleaned
