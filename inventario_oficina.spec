# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_all


root = Path.cwd().resolve()
datas = [
    (str(root / "frontend" / "dist"), "frontend_dist"),
    (str(root / "inventario.db"), "."),
    (str(root / "AutoCardoso.png"), "."),
]

legacy_excel = root / "Base_dados.xlsx"
if legacy_excel.exists():
    datas.append((str(legacy_excel), "."))

binaries = []
hiddenimports = []
for package_name in ("anyio", "fastapi", "openpyxl", "pydantic", "pydantic_core", "starlette", "uvicorn"):
    package_datas, package_binaries, package_hiddenimports = collect_all(package_name)
    datas += package_datas
    binaries += package_binaries
    hiddenimports += package_hiddenimports


a = Analysis(
    [str(root / "backend" / "app" / "desktop_launcher.py")],
    pathex=[str(root / "backend")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="InventarioOficina",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="InventarioOficina",
)
