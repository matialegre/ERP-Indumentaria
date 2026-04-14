-- Informe: Ventas y Stock
-- Parámetros: @FechaInicio, @FechaFin, @Local, @Marca, @Proveedor

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca NVARCHAR(100) = {marca};
DECLARE @Proveedor NVARCHAR(200) = {proveedor};

WITH ResumenVentas AS (
    SELECT 
        CODIGO_ARTICULO,
        SUM(CASE 
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
                THEN CANTIDAD_VENDIDA * -1 
                ELSE CANTIDAD_VENDIDA 
            END) AS TOTAL_VENDIDO
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND PRECIO_UNIDAD > 10
      AND (
            @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
            OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Local, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
    GROUP BY CODIGO_ARTICULO
),
ResumenStock AS (
    SELECT 
        CODIGO_ARTICULO,
        MAX(LTRIM(RTRIM(
            CASE 
                WHEN CHARINDEX('Variante', DESCRIPCION) > 0 
                THEN LEFT(DESCRIPCION, CHARINDEX('Variante', DESCRIPCION) - 1) 
                ELSE DESCRIPCION 
            END
        ))) AS DESCRIPCION,
        SUM(STOCK) AS TOTAL_STOCK
    FROM STOCKS
    WHERE (@Marca IS NULL OR MARCA = @Marca)
      AND (@Proveedor IS NULL OR PROVEEDOR = @Proveedor)
      AND (
            @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
            OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Local, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
    GROUP BY CODIGO_ARTICULO
)

SELECT 
    S.CODIGO_ARTICULO,
    S.DESCRIPCION,
    ISNULL(S.TOTAL_STOCK, 0) AS STOCK_ACTUAL,
    ISNULL(V.TOTAL_VENDIDO, 0) AS CANTIDAD_VENDIDA
FROM ResumenStock S
LEFT JOIN ResumenVentas V ON S.CODIGO_ARTICULO = V.CODIGO_ARTICULO
ORDER BY CANTIDAD_VENDIDA DESC, STOCK_ACTUAL DESC;
