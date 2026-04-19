# Instalacao no PC da oficina

Este executavel nao precisa de Python, Node.js nem configuracoes tecnicas no PC do teu amigo.

## O que deves levar para o PC dele

Usa um destes:

- a pasta `dist\InventarioOficina`
- ou o ficheiro `dist\InventarioOficina-portatil.zip`

Se levares o `.zip`, descompacta primeiro no PC dele.

## Instalacao recomendada

### 1. Copiar a app para uma pasta fixa

Podes instalar em qualquer pasta do PC dele. Para ficar simples, recomendo esta:

```text
C:\InventarioOficina
```

Depois copia para la o conteudo da pasta `InventarioOficina` gerada no build.

No fim, deves ficar com este ficheiro:

```text
C:\InventarioOficina\InventarioOficina.exe
```

Esse caminho e apenas a recomendacao deste guia, nao e obrigatorio. O executavel nao depende do teu caminho local de desenvolvimento.

### 2. Criar atalho no ambiente de trabalho

1. Clica com o botao direito em `InventarioOficina.exe`
2. Escolhe `Enviar para`
3. Escolhe `Ambiente de trabalho (criar atalho)`

Assim o teu amigo passa a abrir a app so com duplo clique no atalho do desktop.

### 3. Primeira execucao

Quando abrir pela primeira vez:

1. Faz duplo clique em `InventarioOficina.exe` ou no atalho
2. O Windows pode mostrar aviso de seguranca do SmartScreen
3. Se isso acontecer:
   - clicar `Mais informacoes`
   - clicar `Executar assim mesmo`

Depois disso:

1. Abre uma pequena janela de controlo da app
2. O browser predefinido abre automaticamente com o inventario

## Muito importante durante o uso

A pequena janela da app deve ficar aberta enquanto ele estiver a usar o inventario.

Pode minimizar essa janela, mas nao a deve fechar enquanto estiver a trabalhar.

Quando terminar de usar a app:

1. fecha o browser
2. fecha tambem a pequena janela da app

## Onde ficam os dados

Os dados nao ficam dentro da pasta onde instalares a app.

Ficam aqui:

```text
%LOCALAPPDATA%\InventarioOficina\inventario.db
```

Na pratica, costuma ser algo deste genero:

```text
C:\Users\NOME_DO_UTILIZADOR\AppData\Local\InventarioOficina\inventario.db
```

Isto e bom porque, quando atualizares a app, os dados dele ficam preservados.

## Como atualizar mais tarde sem perder dados

Quando tiveres uma nova versao:

1. fecha totalmente a app no PC dele
2. apaga ou substitui a pasta onde instalaste a app
3. copia para la a nova pasta `InventarioOficina`
4. volta a usar o mesmo atalho, ou cria um novo se precisares

Os dados antigos devem continuar la porque a base de dados esta fora dessa pasta.

## Se o browser nao abrir sozinho

Nao costuma ser preciso fazer nada, mas se acontecer:

1. olha para a pequena janela da app
2. clica no botao `Abrir inventario`

## Backup recomendado

Se quiseres fazer copia de seguranca dos dados, guarda este ficheiro:

```text
%LOCALAPPDATA%\InventarioOficina\inventario.db
```

## Resumo super curto para o teu amigo

1. Abrir o atalho do inventario
2. Usar normalmente no browser
3. No fim, fechar a janela pequena da app
