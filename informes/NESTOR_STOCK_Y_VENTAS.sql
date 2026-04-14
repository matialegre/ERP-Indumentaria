SET NOCOUNT ON;

DECLARE @cols NVARCHAR(MAX);
DECLARE @sql NVARCHAR(MAX);

-- Parámetros
DECLARE @Marca NVARCHAR(100) = {marca};
DECLARE @Proveedor NVARCHAR(200) = {proveedor};
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Locales NVARCHAR(MAX) = {local};

------------------------------------------------------------
-- 1) Obtener lista dinámica de locales (solo los seleccionados)
------------------------------------------------------------
SELECT @cols = STRING_AGG(
       'SUM(CASE WHEN LOCAL = ''' + LOCAL + ''' THEN TOTAL_VENDIDO ELSE 0 END) AS [CANTIDAD_VENDIDA_' + LOCAL + '],
        SUM(CASE WHEN LOCAL = ''' + LOCAL + ''' THEN TOTAL_STOCK ELSE 0 END) AS [STOCK_' + LOCAL + ']'
, ',')
FROM (
    SELECT DISTINCT REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL
    FROM STOCKS
    WHERE (@Marca IS NULL OR @Marca = '' OR MARCA = @Marca)
      AND (@Proveedor IS NULL OR @Proveedor = '' OR PROVEEDOR = @Proveedor)
      AND (
            @Locales IS NULL OR LTRIM(RTRIM(@Locales)) = ''
            OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Locales, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
) L;

IF @cols IS NULL OR LTRIM(RTRIM(@cols)) = ''
BEGIN
    SET @cols = 'SUM(TOTAL_VENDIDO) AS [CANTIDAD_VENDIDA_TOTAL], SUM(TOTAL_STOCK) AS [STOCK_TOTAL]';
END

------------------------------------------------------------
-- 2) SQL dinámico
------------------------------------------------------------
SET @sql = '
WITH STOCK_AGRUPADO AS (
    SELECT
        REPLACE(LOCAL, ''DRAGONFISH_'', '''') AS LOCAL,
        CODIGO_ARTICULO,
        LTRIM(RTRIM(
            CASE
                WHEN CHARINDEX(''Variante'', DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, CHARINDEX(''Variante'', DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        )) AS ARTICULO_LIMPIO,
        SUM(STOCK) AS TOTAL_STOCK
    FROM STOCKS
    WHERE (@Marca IS NULL OR @Marca = '''' OR MARCA = @Marca)
      AND (@Proveedor IS NULL OR @Proveedor = '''' OR PROVEEDOR = @Proveedor)
      AND (
            @Locales IS NULL OR LTRIM(RTRIM(@Locales)) = ''''
            OR REPLACE(LOCAL, ''DRAGONFISH_'', '''') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Locales, '','')
                WHERE LTRIM(RTRIM(value)) <> ''''
            )
          )
    GROUP BY
        REPLACE(LOCAL, ''DRAGONFISH_'', ''''),
        CODIGO_ARTICULO,
        LTRIM(RTRIM(
            CASE
                WHEN CHARINDEX(''Variante'', DESCRIPCION) > 0
                THEN LEFT(DESCRIPCION, CHARINDEX(''Variante'', DESCRIPCION) - 1)
                ELSE DESCRIPCION
            END
        ))
),
VENTAS_AGRUPADAS AS (
    SELECT
        REPLACE(LOCAL, ''DRAGONFISH_'', '''') AS LOCAL,
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN CHARINDEX('' Variante'', ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX('' Variante'', ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        ) AS ARTICULO_LIMPIO,
        SUM(CANTIDAD_VENDIDA) AS TOTAL_VENDIDO
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND (@Marca IS NULL OR @Marca = '''' OR MARCA = @Marca)
      AND (
            @Locales IS NULL OR LTRIM(RTRIM(@Locales)) = ''''
            OR REPLACE(LOCAL, ''DRAGONFISH_'', '''') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Locales, '','')
                WHERE LTRIM(RTRIM(value)) <> ''''
            )
          )
      AND UPPER(CODIGO_ARTICULO) NOT IN (
          ''AJUSTE'',''NRMPBSABS6NB0ST'',''NRMPBSABS2'',''1'',''3'',
          ''PTF3539APCOUT'',''PTF4539APCOUT'',''PTR2530APCOUT'',
          ''PTF7050APCOUT'',''DESCUENTO'',''NRMPBSABS1'',
          ''NRMPBSABS5'',''2''
      )
    GROUP BY
        REPLACE(LOCAL, ''DRAGONFISH_'', ''''),
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN CHARINDEX('' Variante'', ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX('' Variante'', ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        )
),
BASE AS (
    SELECT
        COALESCE(S.LOCAL, V.LOCAL) AS LOCAL,
        COALESCE(S.CODIGO_ARTICULO, V.CODIGO_ARTICULO) AS CODIGO_ARTICULO,
        COALESCE(S.ARTICULO_LIMPIO, V.ARTICULO_LIMPIO) AS ARTICULO_LIMPIO,
        ISNULL(V.TOTAL_VENDIDO, 0) AS TOTAL_VENDIDO,
        ISNULL(S.TOTAL_STOCK, 0) AS TOTAL_STOCK
    FROM STOCK_AGRUPADO S
    FULL OUTER JOIN VENTAS_AGRUPADAS V
        ON S.LOCAL = V.LOCAL
        AND S.CODIGO_ARTICULO = V.CODIGO_ARTICULO
)

SELECT
    CODIGO_ARTICULO,
    ARTICULO_LIMPIO,
    ' + @cols + '
FROM BASE
GROUP BY
    CODIGO_ARTICULO,
    ARTICULO_LIMPIO
ORDER BY
    ARTICULO_LIMPIO;
';

------------------------------------------------------------
-- 3) Ejecutar
------------------------------------------------------------
EXEC sp_executesql
    @sql,
    N'@Marca NVARCHAR(100), @Proveedor NVARCHAR(200), @FechaInicio DATE, @FechaFin DATE, @Locales NVARCHAR(MAX)',
    @Marca = @Marca,
    @Proveedor = @Proveedor,
    @FechaInicio = @FechaInicio,
    @FechaFin = @FechaFin,
    @Locales = @Locales;
