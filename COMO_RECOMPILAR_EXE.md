# Como recompilar o executavel

Este projeto ficou preparado para gerar um executavel Windows sem precisares de repetir passos manuais chatos.

## O que foi feito

O executavel foi montado assim:

1. O frontend React e compilado com `vite build`.
2. O backend FastAPI serve esse frontend compilado diretamente.
3. Um launcher Windows (`backend/app/desktop_launcher.py`) arranca o servidor local, abre a app no browser e mostra uma janela pequena para manter a app ativa.
4. O PyInstaller empacota tudo numa pasta final:
   - executavel
   - backend Python
   - frontend compilado
   - base de dados seed `inventario.db`
   - logo `AutoCardoso.png`

Os dados do utilizador nao ficam dentro da pasta do executavel. Na primeira execucao, a base de dados e copiada para:

`%LOCALAPPDATA%\InventarioOficina\inventario.db`

Isto significa que podes substituir a pasta do programa numa atualizacao sem perder os dados do teu amigo.

## Sobre os paths

Os paths importantes ficaram preparados para nao dependerem do teu PC:

- `build_exe.ps1` descobre a raiz do repositorio pela pasta onde o proprio script esta
- `inventario_oficina.spec` e usado a partir dessa raiz pelo script de build
- o executavel vai buscar os recursos ao proprio bundle
- a base de dados persistente vai para `%LOCALAPPDATA%\InventarioOficina`

Ou seja: nao ficou nenhum caminho preso ao teu `C:\AI_code\inventario_novo`.

## Ficheiros importantes deste processo

- `build_exe.ps1`: script principal de build
- `inventario_oficina.spec`: configuracao do PyInstaller
- `backend/app/desktop_launcher.py`: launcher do executavel
- `backend/app/main.py`: backend a servir API + frontend compilado
- `backend/app/core/config.py`: caminhos dos dados em modo desenvolvimento e em modo executavel

## Comando recomendado

Abre PowerShell na raiz do projeto e corre:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

Em alternativa, podes usar:

```powershell
npm run build:exe
```

## O que o script faz

O `build_exe.ps1` faz isto automaticamente:

1. Sincroniza as dependencias Python do backend com `uv`
2. Garante as dependencias do frontend
3. Compila o frontend
4. Limpa builds antigos
5. Gera o executavel com PyInstaller
6. Corre um smoke test ao proprio executavel
7. Cria um `.zip` pronto para entregar

## Resultado final

Depois do build vais ter:

- `dist\InventarioOficina\InventarioOficina.exe`
- `dist\InventarioOficina-portatil.zip`

## Processo exato para futuras alteracoes

Sempre que alterares codigo:

1. Guarda as alteracoes do projeto
2. Abre PowerShell na pasta do repositorio
3. Corre:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

4. Espera pelo fim do smoke test
5. Entrega a nova pasta `dist\InventarioOficina` ou o ficheiro `dist\InventarioOficina-portatil.zip`

## Regra pratica importante

Nao recompiles "a mao" com comandos soltos do PyInstaller, a menos que estejas mesmo a mexer no processo de empacotamento.

Para evitar erros, usa sempre o mesmo comando:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

Os launchers antigos de desenvolvimento (`start_app.bat` e `start_app.vbs`) tambem foram ajustados para trabalhar com paths relativos a partir da pasta onde estiverem.

Nota: a pasta temporaria `build\` criada pelo PyInstaller pode conter ficheiros `.toc` com paths do PC onde fizeste a compilacao. Isso e normal, nao afeta o executavel e essa pasta nao e para entregar ao teu amigo.

## Se o build falhar

Confirma primeiro:

1. Que estas na raiz do projeto
2. Que o frontend continua a compilar
3. Que existe `inventario.db` na raiz
4. Que o PowerShell foi aberto com permissao normal e o comando foi corrido exatamente como acima

## Validacao incluida

O executavel ja foi validado com smoke test automatico durante o build. Esse teste confirma:

- arranque do backend
- resposta do healthcheck
- resposta do schema
- exportacao Excel
- frontend servido corretamente
