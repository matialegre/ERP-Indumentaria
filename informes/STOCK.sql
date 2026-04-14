SET NOCOUNT ON;

DECLARE @cols NVARCHAR(MAX);
DECLARE @sql  NVARCHAR(MAX);

-- Parámetros de filtro
DECLARE @Marca     NVARCHAR(100) = {marca};
DECLARE @Proveedor NVARCHAR(200) = {proveedor};

-- 1. Lista dinámica de locales (ya filtrada)
SELECT @cols = STRING_AGG(QUOTENAME(LOCAL), ',')
FROM (
    SELECT DISTINCT LOCAL
    FROM STOCKS
    WHERE (@Marca IS NULL OR MARCA = @Marca)
      AND (@Proveedor IS NULL OR PROVEEDOR = @Proveedor)
) l;

-- 2. SQL dinámico
SET @sql = '
SELECT
    MARCA,
    CODIGO_ARTICULO,
    CODIGO_COLOR,
    CODIGO_TALLE,
    DESCRIPCION,
    ' + @cols + '
FROM (
    SELECT
        MARCA,
        CODIGO_ARTICULO,
        CODIGO_COLOR,
        CODIGO_TALLE,
        LTRIM(RTRIM(
            CASE
                WHEN CHARINDEX(''Variante'', DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, CHARINDEX(''Variante'', DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        )) AS DESCRIPCION,
        LOCAL,
        STOCK
    FROM STOCKS
    WHERE (@Marca IS NULL OR MARCA = @Marca)
      AND (@Proveedor IS NULL OR PROVEEDOR = @Proveedor)
) src
PIVOT (
    MAX(STOCK)
    FOR LOCAL IN (' + @cols + ')
) p
ORDER BY
    MARCA,
    DESCRIPCION,
    CODIGO_COLOR,
    CODIGO_TALLE;
';

-- 3. Ejecutar con parámetros
EXEC sp_executesql
    @sql,
    N'@Marca NVARCHAR(100), @Proveedor NVARCHAR(200)',
    @Marca = @Marca,
    @Proveedor = @Proveedor;
