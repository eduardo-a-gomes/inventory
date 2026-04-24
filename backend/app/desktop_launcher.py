"""Launcher Windows para a versao executavel da aplicacao."""

from __future__ import annotations

import argparse
import logging
import os
import socket
import threading
import time
import tkinter as tk
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from tkinter import messagebox, ttk

import uvicorn

from app.core.config import APP_DATA_DIR, BUNDLE_ROOT


APP_TITLE = "Inventario Oficina"
SERVER_HOST = "127.0.0.1"
LOG_PATH = (APP_DATA_DIR / "inventario_launcher.log").resolve()
LOGGER = logging.getLogger("inventario_launcher")


def configure_logging() -> None:
    """Configura logging persistente para diagnostico no PC do utilizador."""
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

    if LOGGER.handlers:
        return

    LOGGER.setLevel(logging.INFO)
    handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
    LOGGER.addHandler(handler)
    LOGGER.propagate = False
    LOGGER.info("Launcher iniciado.")


class ServerThread(threading.Thread):
    """Corre o Uvicorn numa thread separada."""

    def __init__(self, port: int) -> None:
        super().__init__(daemon=True)
        self.port = port
        self.server: uvicorn.Server | None = None
        self.error: Exception | None = None

    def run(self) -> None:
        LOGGER.info("A arrancar servidor local na porta %s.", self.port)
        try:
            from app.main import app as fastapi_app

            config = uvicorn.Config(
                app=fastapi_app,
                host=SERVER_HOST,
                port=self.port,
                log_level="warning",
                access_log=False,
                log_config=None,
            )
            self.server = uvicorn.Server(config)
            self.server.install_signal_handlers = lambda: None
            self.server.run()
            LOGGER.info("Servidor local terminou normalmente.")
        except Exception as exc:  # pragma: no cover - caminho excecional de arranque
            self.error = exc
            LOGGER.exception("Erro ao arrancar o servidor local.")

    def stop(self) -> None:
        if self.server is not None:
            LOGGER.info("Pedido de fecho do servidor local.")
            self.server.should_exit = True


def encontrar_porta_livre() -> int:
    """Reserva uma porta livre temporaria no localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((SERVER_HOST, 0))
        return int(sock.getsockname()[1])


def construir_base_url(port: int) -> str:
    """Constroi o URL base da aplicacao local."""
    return f"http://{SERVER_HOST}:{port}"


def esperar_servidor(base_url: str, server_thread: ServerThread, timeout: float = 45.0) -> None:
    """Espera ate o backend responder ao healthcheck."""
    deadline = time.time() + timeout
    health_url = f"{base_url}/api/health"

    while time.time() < deadline:
        if server_thread.error is not None:
            raise RuntimeError("O servidor terminou com erro durante o arranque.") from server_thread.error

        try:
            with urllib.request.urlopen(health_url, timeout=2) as response:
                if response.status == 200:
                    LOGGER.info("Healthcheck respondeu com 200 em %s.", health_url)
                    return
        except urllib.error.URLError:
            time.sleep(0.25)

    raise RuntimeError("A app nao respondeu ao healthcheck dentro do tempo esperado.")


def smoke_test() -> int:
    """Valida se o executavel consegue arrancar backend e frontend corretamente."""
    configure_logging()
    LOGGER.info("A executar smoke test do launcher.")

    port = encontrar_porta_livre()
    base_url = construir_base_url(port)
    server_thread = ServerThread(port)
    server_thread.start()

    try:
        esperar_servidor(base_url, server_thread, timeout=45)

        with urllib.request.urlopen(f"{base_url}/api/schema/colunas", timeout=5) as response:
            if response.status != 200:
                raise RuntimeError("O endpoint /api/schema/colunas nao respondeu com 200.")

        with urllib.request.urlopen(f"{base_url}/api/export/excel", timeout=10) as response:
            content_type = response.headers.get("Content-Type", "")
            if "spreadsheetml" not in content_type:
                raise RuntimeError("O endpoint /api/export/excel nao devolveu um ficheiro Excel.")

        with urllib.request.urlopen(base_url, timeout=5) as response:
            html = response.read().decode("utf-8", errors="ignore")
            if '<div id="root"></div>' not in html:
                raise RuntimeError("O frontend compilado nao foi servido corretamente.")
    finally:
        server_thread.stop()
        server_thread.join(timeout=5)

    LOGGER.info("Smoke test concluido com sucesso.")
    return 0


class LauncherWindow:
    """Janela de controlo simples para manter a app viva enquanto o browser esta aberto."""

    def __init__(self) -> None:
        self.port = encontrar_porta_livre()
        self.base_url = construir_base_url(self.port)
        self.server_thread = ServerThread(self.port)
        self.logo_image: tk.PhotoImage | None = None

        self.root = tk.Tk()
        self.root.title(APP_TITLE)
        self.root.geometry("500x300")
        self.root.minsize(500, 300)
        self.root.resizable(True, False)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.status_var = tk.StringVar(value="A iniciar o servidor local...")
        self.info_var = tk.StringVar(
            value="Aguarde alguns segundos. Se o browser nao abrir sozinho, use o botao abaixo."
        )
        self.url_var = tk.StringVar(value=self.base_url)
        self.log_var = tk.StringVar(value=str(LOG_PATH))

        self.open_button: ttk.Button | None = None
        self._load_window_icon()
        self._build_ui()
        self.root.update_idletasks()

    def _load_window_icon(self) -> None:
        logo_path = Path(BUNDLE_ROOT) / "AutoCardoso.png"
        if not logo_path.exists():
            return

        try:
            self.logo_image = tk.PhotoImage(file=str(logo_path))
            self.root.iconphoto(True, self.logo_image)
        except tk.TclError:
            self.logo_image = None

    def _build_ui(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        frame = ttk.Frame(self.root, padding=18)
        frame.grid(row=0, column=0, sticky="nsew")
        frame.columnconfigure(1, weight=1)

        if self.logo_image is not None:
            ttk.Label(frame, image=self.logo_image).grid(row=0, column=0, rowspan=2, padx=(0, 14), sticky="n")

        ttk.Label(frame, text=APP_TITLE, font=("Segoe UI", 15, "bold")).grid(row=0, column=1, sticky="w")
        ttk.Label(
            frame,
            textvariable=self.status_var,
            wraplength=340,
            justify="left",
        ).grid(row=1, column=1, pady=(8, 10), sticky="w")
        ttk.Label(
            frame,
            textvariable=self.info_var,
            wraplength=440,
            justify="left",
        ).grid(row=2, column=0, columnspan=2, sticky="w")
        ttk.Label(
            frame,
            text="Endereco local da app:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=3, column=0, columnspan=2, pady=(14, 2), sticky="w")
        ttk.Label(
            frame,
            textvariable=self.url_var,
            wraplength=440,
            justify="left",
        ).grid(row=4, column=0, columnspan=2, sticky="w")
        ttk.Label(
            frame,
            text="Ficheiro de log:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=5, column=0, columnspan=2, pady=(14, 2), sticky="w")
        ttk.Label(
            frame,
            textvariable=self.log_var,
            wraplength=440,
            justify="left",
        ).grid(row=6, column=0, columnspan=2, sticky="w")

        buttons = ttk.Frame(frame)
        buttons.grid(row=7, column=0, columnspan=2, pady=(18, 0), sticky="ew")
        buttons.columnconfigure(0, weight=1)
        buttons.columnconfigure(1, weight=1)
        buttons.columnconfigure(2, weight=1)

        self.open_button = ttk.Button(buttons, text="Abrir inventario", command=self.open_browser, state="disabled")
        self.open_button.grid(row=0, column=0, padx=(0, 8), sticky="ew")
        ttk.Button(buttons, text="Abrir pasta dos dados", command=self.open_data_folder).grid(
            row=0,
            column=1,
            padx=(0, 8),
            sticky="ew",
        )
        ttk.Button(buttons, text="Fechar", command=self.on_close).grid(row=0, column=2, sticky="ew")

    def start(self) -> int:
        LOGGER.info("Janela principal criada. A iniciar bootstrap.")
        self.server_thread.start()
        threading.Thread(target=self._bootstrap, daemon=True).start()
        self.root.mainloop()
        LOGGER.info("Janela principal fechada.")
        return 0

    def _bootstrap(self) -> None:
        try:
            esperar_servidor(self.base_url, self.server_thread, timeout=45)
            self.root.after(0, self._on_ready)
        except Exception as exc:
            LOGGER.exception("Falha no bootstrap do launcher.")
            self.root.after(0, lambda exc=exc: self._on_startup_error(exc))

    def _on_ready(self) -> None:
        self.status_var.set("Aplicacao pronta.")
        self.info_var.set(
            "Vou tentar abrir o browser automaticamente. Se nao abrir, clique em 'Abrir inventario'."
        )
        if self.open_button is not None:
            self.open_button.config(state="normal")
        self.open_browser(auto=True)

    def _on_startup_error(self, exc: Exception) -> None:
        self.status_var.set("Falha ao arrancar a aplicacao.")
        self.info_var.set("Veja o ficheiro de log mostrado abaixo para perceber o erro.")
        messagebox.showerror(
            APP_TITLE,
            f"Nao foi possivel iniciar a aplicacao.\n\n{exc}\n\nLog: {LOG_PATH}",
        )

    def _open_browser_worker(self, auto: bool) -> None:
        try:
            LOGGER.info("A pedir ao Windows para abrir o browser. URL=%s | auto=%s", self.base_url, auto)
            try:
                os.startfile(self.base_url)
            except AttributeError:
                opened = webbrowser.open(self.base_url, new=1)
                if not opened:
                    raise RuntimeError("O Windows nao indicou um browser disponivel.")
            except OSError:
                opened = webbrowser.open(self.base_url, new=1)
                if not opened:
                    raise

            self.root.after(0, lambda auto=auto: self._on_browser_opened(auto))
        except Exception as exc:
            LOGGER.exception("Falha ao abrir o browser automaticamente.")
            self.root.after(0, lambda exc=exc: self._on_browser_error(exc))

    def _on_browser_opened(self, auto: bool) -> None:
        if auto:
            self.status_var.set("Aplicacao pronta. Browser aberto automaticamente.")
            self.info_var.set("A janela foi minimizada automaticamente. Feche-a quando terminar para desligar a app.")
            self.root.after(300, self._minimize_window)
        else:
            self.status_var.set("Aplicacao pronta. Pedido manual para abrir o browser enviado.")
            self.info_var.set("Pode minimizar esta janela. Feche-a quando terminar para desligar a app.")

    def _minimize_window(self) -> None:
        """Minimiza a janela de controlo sem fechar o servidor local."""
        LOGGER.info("A minimizar a janela principal do launcher.")
        try:
            self.root.update_idletasks()
            self.root.iconify()
        except tk.TclError:
            LOGGER.warning("Nao foi possivel minimizar a janela principal.")

    def _on_browser_error(self, exc: Exception) -> None:
        self.status_var.set("Aplicacao pronta, mas o browser nao abriu automaticamente.")
        self.info_var.set(
            "Clique em 'Abrir inventario' ou abra manualmente o endereco acima. Se falhar, veja o ficheiro de log."
        )
        messagebox.showwarning(
            APP_TITLE,
            f"Nao foi possivel abrir o browser automaticamente.\n\n{exc}\n\nUse o botao 'Abrir inventario'.",
        )

    def open_browser(self, auto: bool = False) -> None:
        if auto:
            self.status_var.set("Aplicacao pronta. A pedir ao Windows para abrir o browser...")
        else:
            self.status_var.set("A tentar abrir o browser...")
        threading.Thread(target=self._open_browser_worker, args=(auto,), daemon=True).start()

    def open_data_folder(self) -> None:
        LOGGER.info("A abrir pasta dos dados: %s", APP_DATA_DIR)
        try:
            os.startfile(str(APP_DATA_DIR))
        except Exception as exc:
            LOGGER.exception("Falha ao abrir a pasta dos dados.")
            messagebox.showwarning(APP_TITLE, f"Nao foi possivel abrir a pasta dos dados.\n\n{exc}")

    def on_close(self) -> None:
        LOGGER.info("Pedido de fecho do launcher.")
        self.server_thread.stop()
        self.root.destroy()


def parse_args() -> argparse.Namespace:
    """Le os argumentos da linha de comandos."""
    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument(
        "--smoke-test",
        action="store_true",
        help="Arranca a app, valida os principais endpoints e termina.",
    )
    return parser.parse_args()


def main() -> int:
    """Ponto de entrada principal."""
    configure_logging()
    args = parse_args()
    if args.smoke_test:
        return smoke_test()

    launcher = LauncherWindow()
    return launcher.start()


if __name__ == "__main__":
    raise SystemExit(main())
