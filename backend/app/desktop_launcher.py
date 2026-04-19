"""Launcher Windows para a versao executavel da aplicacao."""

from __future__ import annotations

import argparse
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
from app.main import app


APP_TITLE = "Inventario Oficina"
SERVER_HOST = "127.0.0.1"


class ServerThread(threading.Thread):
    """Corre o Uvicorn numa thread separada."""

    def __init__(self, port: int) -> None:
        super().__init__(daemon=True)
        self.port = port
        self.server: uvicorn.Server | None = None
        self.error: Exception | None = None

    def run(self) -> None:
        try:
            config = uvicorn.Config(
                app=app,
                host=SERVER_HOST,
                port=self.port,
                log_level="warning",
                access_log=False,
            )
            self.server = uvicorn.Server(config)
            self.server.install_signal_handlers = lambda: None
            self.server.run()
        except Exception as exc:  # pragma: no cover - caminho excecional de arranque
            self.error = exc

    def stop(self) -> None:
        if self.server is not None:
            self.server.should_exit = True


def encontrar_porta_livre() -> int:
    """Reserva uma porta livre temporaria no localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((SERVER_HOST, 0))
        return int(sock.getsockname()[1])


def construir_base_url(port: int) -> str:
    """Constroi o URL base da aplicacao local."""
    return f"http://{SERVER_HOST}:{port}"


def esperar_servidor(base_url: str, server_thread: ServerThread, timeout: float = 30.0) -> None:
    """Espera ate o backend responder ao healthcheck."""
    deadline = time.time() + timeout
    health_url = f"{base_url}/api/health"

    while time.time() < deadline:
        if server_thread.error is not None:
            raise RuntimeError("O servidor terminou com erro durante o arranque.") from server_thread.error

        try:
            with urllib.request.urlopen(health_url, timeout=2) as response:
                if response.status == 200:
                    return
        except urllib.error.URLError:
            time.sleep(0.25)

    raise RuntimeError("A app nao respondeu ao healthcheck dentro do tempo esperado.")


def smoke_test() -> int:
    """Valida se o executavel consegue arrancar backend e frontend corretamente."""
    port = encontrar_porta_livre()
    base_url = construir_base_url(port)
    server_thread = ServerThread(port)
    server_thread.start()

    try:
        esperar_servidor(base_url, server_thread, timeout=35)

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
        self.root.geometry("450x240")
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.status_var = tk.StringVar(value="A iniciar a aplicacao...")
        self.info_var = tk.StringVar(value="Quando a app abrir no browser, pode minimizar esta janela.")
        self.url_var = tk.StringVar(value=self.base_url)

        self.open_button: ttk.Button | None = None
        self._load_window_icon()
        self._build_ui()

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
            wraplength=290,
            justify="left",
        ).grid(row=1, column=1, pady=(8, 10), sticky="w")
        ttk.Label(
            frame,
            textvariable=self.info_var,
            wraplength=390,
            justify="left",
        ).grid(row=2, column=0, columnspan=2, sticky="w")
        ttk.Label(
            frame,
            text="Pasta dos dados:",
            font=("Segoe UI", 9, "bold"),
        ).grid(row=3, column=0, columnspan=2, pady=(14, 2), sticky="w")
        ttk.Label(
            frame,
            text=str(APP_DATA_DIR),
            wraplength=390,
            justify="left",
        ).grid(row=4, column=0, columnspan=2, sticky="w")
        ttk.Label(
            frame,
            textvariable=self.url_var,
            foreground="#4d4d4d",
            wraplength=390,
            justify="left",
        ).grid(row=5, column=0, columnspan=2, pady=(12, 0), sticky="w")

        buttons = ttk.Frame(frame)
        buttons.grid(row=6, column=0, columnspan=2, pady=(18, 0), sticky="ew")
        buttons.columnconfigure(0, weight=1)
        buttons.columnconfigure(1, weight=1)

        self.open_button = ttk.Button(buttons, text="Abrir inventario", command=self.open_browser, state="disabled")
        self.open_button.grid(row=0, column=0, padx=(0, 8), sticky="ew")
        ttk.Button(buttons, text="Fechar", command=self.on_close).grid(row=0, column=1, sticky="ew")

    def start(self) -> int:
        self.server_thread.start()
        threading.Thread(target=self._bootstrap, daemon=True).start()
        self.root.mainloop()
        return 0

    def _bootstrap(self) -> None:
        try:
            esperar_servidor(self.base_url, self.server_thread, timeout=35)
            self.root.after(0, self._on_ready)
        except Exception as exc:
            self.root.after(0, lambda: self._on_startup_error(exc))

    def _on_ready(self) -> None:
        self.status_var.set("Aplicacao pronta. A abrir no browser predefinido...")
        self.info_var.set("Pode minimizar esta janela. Feche-a quando terminar para desligar a app.")
        if self.open_button is not None:
            self.open_button.config(state="normal")
        self.open_browser()

    def _on_startup_error(self, exc: Exception) -> None:
        self.status_var.set("Falha ao arrancar a aplicacao.")
        self.info_var.set("Feche esta janela e consulte a mensagem abaixo.")
        messagebox.showerror(APP_TITLE, f"Nao foi possivel iniciar a aplicacao.\n\n{exc}")

    def open_browser(self) -> None:
        webbrowser.open(self.base_url, new=1)
        self.status_var.set("Aplicacao aberta no browser.")

    def on_close(self) -> None:
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
    args = parse_args()
    if args.smoke_test:
        return smoke_test()

    launcher = LauncherWindow()
    return launcher.start()


if __name__ == "__main__":
    raise SystemExit(main())
