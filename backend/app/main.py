"""Entrada principal da API FastAPI."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import FRONTEND_DIST_DIR
from app.schemas import (
    AdicionarColunaPayload,
    AtualizarVendaHistoricoPayload,
    DashboardVendas,
    AtualizarQuantidadePayload,
    ColunaSchema,
    Peca,
    PecaCreate,
    PecaUpdate,
    PreferenciaTemaFundo,
    RegistarVendaPayload,
    RegistoVendaResultado,
    ReordenarColunasPayload,
    RenomearColunaPayload,
    VendaHistoricoItem,
)
from app.services.excel_repository import ExcelRepository

app = FastAPI(
    title="Inventario Oficina - AutoCardoso",
    description="API para gerir o inventario de pecas usando SQLite como base de dados.",
    version="1.0.0",
)
api_router = APIRouter()

# Permite que o frontend React, em modo de desenvolvimento, consuma a API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = ExcelRepository()


@api_router.get("/health")
def healthcheck() -> dict:
    """Endpoint simples para verificar se a API esta viva."""
    return {"status": "ok"}


@api_router.get("/pecas", response_model=list[Peca])
def listar_pecas(q: str | None = Query(default=None, description="Termo de pesquisa opcional.")) -> list[Peca]:
    """Lista pecas, com pesquisa textual opcional."""
    try:
        return repo.listar(termo=q)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.get("/vendas", response_model=list[VendaHistoricoItem])
def listar_vendas() -> list[VendaHistoricoItem]:
    """Lista o historico de vendas registadas."""
    try:
        return repo.listar_vendas()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.patch("/vendas/{venda_id}", response_model=VendaHistoricoItem)
def atualizar_venda_historico(venda_id: str, payload: AtualizarVendaHistoricoPayload) -> VendaHistoricoItem:
    """Edita um registo do historico de vendas e ajusta o stock em conformidade."""
    try:
        venda = repo.atualizar_venda_historico(venda_id, payload.quantidade_vendida, payload.preco_unitario)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not venda:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venda nao encontrada.")
    return venda


@api_router.delete("/vendas/{venda_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_venda_historico(venda_id: str) -> Response:
    """Elimina um registo do historico de vendas sem alterar o stock atual."""
    try:
        removed = repo.eliminar_venda_historico(venda_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venda nao encontrada.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@api_router.post("/vendas/{venda_id}/repor", response_model=Peca)
def repor_venda_no_inventario(venda_id: str) -> Peca:
    """Repõe a quantidade vendida no inventario e remove a venda do historico."""
    try:
        peca = repo.repor_venda_no_inventario(venda_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not peca:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venda nao encontrada.")
    return peca


@api_router.get("/dashboard/vendas", response_model=DashboardVendas)
def obter_dashboard_vendas() -> DashboardVendas:
    """Devolve resumo, graficos e historico para o dashboard de vendas."""
    try:
        return repo.obter_dashboard_vendas()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.get("/preferencias/tema-fundo", response_model=PreferenciaTemaFundo)
def obter_preferencia_tema_fundo() -> PreferenciaTemaFundo:
    """Devolve o tema de fundo persistido."""
    try:
        return repo.obter_tema_fundo()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.put("/preferencias/tema-fundo", response_model=PreferenciaTemaFundo)
def guardar_preferencia_tema_fundo(payload: PreferenciaTemaFundo) -> PreferenciaTemaFundo:
    """Guarda o tema de fundo persistido."""
    try:
        return repo.guardar_tema_fundo(payload.tema)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@api_router.get("/schema/colunas", response_model=list[ColunaSchema])
def listar_colunas() -> list[ColunaSchema]:
    """Lista o schema atual de colunas da tabela."""
    try:
        return repo.obter_colunas()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.post("/schema/colunas", response_model=ColunaSchema, status_code=status.HTTP_201_CREATED)
def adicionar_coluna(payload: AdicionarColunaPayload) -> ColunaSchema:
    """Adiciona uma coluna dinamica ao schema."""
    try:
        return repo.adicionar_coluna(payload.nome)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@api_router.patch("/schema/colunas/{chave}", response_model=ColunaSchema)
def renomear_coluna(chave: str, payload: RenomearColunaPayload) -> ColunaSchema:
    """Renomeia uma coluna do schema."""
    try:
        coluna = repo.renomear_coluna(chave, payload.nome)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not coluna:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coluna nao encontrada.")
    return coluna


@api_router.delete("/schema/colunas/{chave}", status_code=status.HTTP_204_NO_CONTENT)
def remover_coluna(chave: str) -> Response:
    """Remove uma coluna dinamica existente."""
    try:
        removed = repo.remover_coluna(chave)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coluna nao encontrada.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@api_router.patch("/schema/colunas-ordem", response_model=list[ColunaSchema])
def reordenar_colunas(payload: ReordenarColunasPayload) -> list[ColunaSchema]:
    """Atualiza a ordem das colunas e devolve o schema final ordenado."""
    try:
        return repo.reordenar_colunas(payload.chaves)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@api_router.get("/export/excel")
def exportar_excel() -> StreamingResponse:
    """Exporta o inventario atual para ficheiro Excel."""
    conteudo = repo.exportar_para_excel()
    nome = f"inventario_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{nome}"'}
    return StreamingResponse(
        iter([conteudo]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@api_router.get("/pecas/{peca_id}", response_model=Peca)
def obter_peca(peca_id: str) -> Peca:
    """Obtem detalhes de uma peca pelo ID."""
    peca = repo.obter_por_id(peca_id)
    if not peca:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peca nao encontrada.")
    return peca


@api_router.post("/pecas", response_model=Peca, status_code=status.HTTP_201_CREATED)
def criar_peca(payload: PecaCreate) -> Peca:
    """Regista uma nova peca no inventario."""
    try:
        return repo.criar(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@api_router.put("/pecas/{peca_id}", response_model=Peca)
def atualizar_peca(peca_id: str, payload: PecaUpdate) -> Peca:
    """Atualiza todos os dados de uma peca."""
    try:
        peca = repo.atualizar(peca_id=peca_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    if not peca:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peca nao encontrada.")
    return peca


@api_router.patch("/pecas/{peca_id}/quantidade", response_model=Peca)
def atualizar_quantidade(peca_id: str, payload: AtualizarQuantidadePayload) -> Peca:
    """Atualiza apenas a quantidade em stock de uma peca."""
    try:
        peca = repo.atualizar_quantidade(peca_id, payload.quantidade)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    if not peca:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peca nao encontrada.")
    return peca


@api_router.post("/pecas/{peca_id}/venda", response_model=RegistoVendaResultado)
def registar_venda(peca_id: str, payload: RegistarVendaPayload) -> RegistoVendaResultado:
    """Regista a venda de unidades e atualiza o stock atual."""
    try:
        resultado = repo.registar_venda(peca_id, payload.quantidade, payload.obter_preco_total())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not resultado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peca nao encontrada.")
    return resultado


@api_router.delete("/pecas/{peca_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_peca(peca_id: str) -> Response:
    """Remove uma peca do inventario."""
    try:
        removed = repo.eliminar(peca_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Peca nao encontrada.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


app.include_router(api_router)
app.include_router(api_router, prefix="/api")

if FRONTEND_DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST_DIR, html=True), name="frontend")
