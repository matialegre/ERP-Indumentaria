-- Informe: Ventas Detalladas por Comprobante
-- Parámetros: @CodigoArticulo, @CodigoPromocion, @FechaInicio, @FechaFin, @Local, @Marca

-- DECLARACIÓN DE VARIABLES
DECLARE @CodigoArticulo VARCHAR(50) = {codigo_articulo};
DECLARE @CodigoPromocion VARCHAR(50) = {codigo_promocion};
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca VARCHAR(50) = {marca};

-- CONSULTA
SELECT
    CAST(FECHA AS DATE) AS FECHA,
    LOCAL,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    VENDEDOR,
    ISNULL(CODIGOPROMOCION, '') AS CODIGOPROMOCION,
    CODIGO_ARTICULO,

    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END) AS ARTICULO,

    SUM(CANTIDAD_VENDIDA) AS TOTAL_CANTIDAD

FROM VENTAS

WHERE
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin

    AND VENDEDOR IS NOT NULL
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''

    AND (CODIGO_ARTICULO = @CodigoArticulo OR @CodigoArticulo IS NULL)

    AND (
            @CodigoPromocion IS NULL
         OR (@CodigoPromocion = 'None' AND CODIGOPROMOCION IS NULL)
         OR (CODIGOPROMOCION = @CodigoPromocion)
        )

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
    CAST(FECHA AS DATE),
    LOCAL,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    VENDEDOR,
    ISNULL(CODIGOPROMOCION, ''),
    CODIGO_ARTICULO,
    TRIM(CASE
        WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
        THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
        ELSE ARTICULO_DESCRIPCION
    END)

ORDER BY
    FECHA ASC,
    LOCAL ASC,
    COMPROBANTE_NUMERO ASC;
