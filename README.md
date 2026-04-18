# Inventario de Oficina - AutoCardoso

Aplicacao fullstack para gerir stock de pecas numa oficina mecanica:

- `Frontend`: React (Vite)
- `Backend`: FastAPI (Python)
- `Base de dados`: SQLite (`inventario.db`)

A aplicacao usa base de dados SQL local (SQLite), sem necessidade de servidor externo.

## Funcionalidades

- Listar pecas
- Pesquisar por texto (referencia, categoria, marca, designacao, local, etc.)
- Adicionar novas pecas
- Editar pecas existentes
- Atualizar quantidade rapidamente (`+` e `-`)
- Eliminar pecas
- Integracao com logo da oficina (`AutoCardoso.png`)

## Estrutura

```text
inventario_novo/
  package.json
  inventario.db
  AutoCardoso.png
  backend/
    pyproject.toml
    app/
      core/
      services/
      main.py
  frontend/
    public/AutoCardoso.png
    src/
```

## Requisitos

- Python 3.11+ (recomendado)
- Node.js 18+ (recomendado)
- `uv` instalado

## Arranque rapido

### 1. Instalar dependencias (uma vez)

```bash
npm install
npm run setup
```

O comando `setup` faz:

- `uv sync --project backend` (backend)
- `npm --prefix frontend install` (frontend)

### 2. Arrancar backend + frontend com um unico comando

```bash
npm run dev
```

Este comando inicia:

- Backend em `http://localhost:8000` (docs em `http://localhost:8000/docs`)
- Frontend em `http://localhost:5173`

## Arranque com duplo clique (Windows)

Para abrir sem terminal, usa o ficheiro:

- `Abrir_Inventario.bat`

Este launcher corre o script `arrancar_app.sh`, valida dependencias e arranca backend + frontend.
Se for a primeira vez, instala automaticamente o que falta no projeto.

## Comandos individuais (opcional)

```bash
npm run dev:backend
npm run dev:frontend
```

## Configuracao opcional

Pode usar variaveis de ambiente no backend:

- `SQLITE_DB_PATH`: caminho para o ficheiro SQLite
- `LEGACY_EXCEL_PATH`: caminho do Excel antigo para migracao inicial (opcional)
- `LEGACY_EXCEL_SHEET_NAME`: nome da folha no Excel antigo

Exemplo:

```bash
SQLITE_DB_PATH=../inventario.db
LEGACY_EXCEL_PATH=../Base_dados.xlsx
LEGACY_EXCEL_SHEET_NAME=Sheet1
```

No frontend, por defeito, a app usa `VITE_API_URL=/api` (proxy Vite para FastAPI).
Se precisares, ajusta em `frontend/.env`.

## Notas tecnicas

- Na primeira execucao, se existir `Base_dados.xlsx` e a BD SQL estiver vazia, os dados sao migrados automaticamente.
- O backend gere colunas dinamicas atraves da tabela de schema (`/schema/colunas`).
- A interface foi desenhada com estilo sobrio e tema mecanico (tons metalicos + destaque verde).
