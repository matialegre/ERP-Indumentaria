-- Informe: Ventas y Stock por Color y Talle
-- Parámetros: @FechaInicio, @FechaFin, @Local, @Marca, @Proveedor

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca NVARCHAR(100) = {marca};
DECLARE @Proveedor NVARCHAR(200) = {proveedor};

WITH LocalesSeleccionados AS (
    SELECT DISTINCT LTRIM(RTRIM(value)) AS LOCAL_LIMPIO
    FROM STRING_SPLIT(ISNULL(@Local, ''), ',')
    WHERE LTRIM(RTRIM(value)) <> ''
),
VentasAgg AS (
    SELECT 
        CODIGO_ARTICULO,
        CODIGO_COLOR,
        CODIGO_TALLE,
        SUM(CASE 
                WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
                THEN CANTIDAD_VENDIDA * -1 
                ELSE CANTIDAD_VENDIDA 
            END) AS TOTAL_VENDIDO
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND PRECIO_UNIDAD > 10
      AND (
            (
                (@Local IS NULL OR LTRIM(RTRIM(@Local)) = '')
                AND LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) <> ''
            )
            OR (
                (@Local IS NOT NULL AND LTRIM(RTRIM(@Local)) <> '')
                AND LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) IN (
                    SELECT LOCAL_LIMPIO
                    FROM LocalesSeleccionados
                )
            )
          )
    GROUP BY CODIGO_ARTICULO, CODIGO_COLOR, CODIGO_TALLE
),
StockAgg AS (
    SELECT 
        CODIGO_ARTICULO,
        CODIGO_COLOR,
        CODIGO_TALLE,
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
            (
                (@Local IS NULL OR LTRIM(RTRIM(@Local)) = '')
                AND LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) <> ''
            )
            OR (
                (@Local IS NOT NULL AND LTRIM(RTRIM(@Local)) <> '')
                AND LTRIM(RTRIM(REPLACE(LOCAL, 'DRAGONFISH_', ''))) IN (
                    SELECT LOCAL_LIMPIO
                    FROM LocalesSeleccionados
                )
            )
          )
    GROUP BY CODIGO_ARTICULO, CODIGO_COLOR, CODIGO_TALLE
)

SELECT
    S.CODIGO_ARTICULO,
    S.CODIGO_COLOR,
    S.CODIGO_TALLE,
    S.DESCRIPCION,
    ISNULL(S.TOTAL_STOCK, 0) AS STOCK_ACTUAL,
    ISNULL(V.TOTAL_VENDIDO, 0) AS CANTIDAD_VENDIDA
FROM StockAgg S
LEFT JOIN VentasAgg V
    ON  S.CODIGO_ARTICULO = V.CODIGO_ARTICULO
    AND S.CODIGO_COLOR = V.CODIGO_COLOR
    AND S.CODIGO_TALLE = V.CODIGO_TALLE
ORDER BY CANTIDAD_VENDIDA DESC, STOCK_ACTUAL DESC;