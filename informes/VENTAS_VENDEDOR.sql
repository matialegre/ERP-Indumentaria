-- Informe: Ventas por Vendedor
-- Parámetros: @CodigoArticulo, @FechaInicio, @FechaFin, @Local, @Marca

-- DECLARACIÓN DE VARIABLES
DECLARE @CodigoArticulo VARCHAR(50) = {codigo_articulo};
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca VARCHAR(50) = {marca};

-- CONSULTA
SELECT 
    'del ' + CONVERT(VARCHAR, @FechaInicio, 103) + ' al ' + CONVERT(VARCHAR, @FechaFin, 103) AS PERIODO,
    MARCA,
    CODIGO_ARTICULO,
    TRIM(CASE 
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0 
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION 
    END) AS ARTICULO_LIMPIO,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_VENDIDO,
    VENDEDOR,
    LOCAL
FROM VENTAS
WHERE 
    -- Filtro de Fechas
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
    
    AND VENDEDOR IS NOT NULL 
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''

    AND (CODIGO_ARTICULO = @CodigoArticulo OR @CodigoArticulo IS NULL)
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )
    AND (MARCA = @Marca OR @Marca IS NULL)

GROUP BY 
    MARCA,
    CODIGO_ARTICULO, 
    TRIM(CASE 
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0 
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION 
    END),
    VENDEDOR, 
    LOCAL
ORDER BY 
    MARCA ASC, 
    TOTAL_VENDIDO DESC;
