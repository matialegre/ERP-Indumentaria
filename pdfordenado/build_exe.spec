# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['reorganizar_gui.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['pdfplumber', 'pandas', 'openpyxl', 'reportlab'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tensorflow', 'torch', 'keras', 'scipy', 'matplotlib', 'PIL',
        'numpy.distutils', 'numba', 'llvmlite', 'cv2', 'sklearn',
        'IPython', 'jupyter', 'notebook', 'pytest', 'sphinx',
        'cryptography', 'paramiko', 'fabric', 'boto3', 'botocore',
        'google', 'azure', 'aws', 'flask', 'django', 'fastapi',
        'uvicorn', 'starlette', 'httpx', 'aiohttp', 'requests',
        'sqlalchemy', 'psycopg2', 'pymysql', 'redis', 'celery',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ReorganizadorInventario',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
