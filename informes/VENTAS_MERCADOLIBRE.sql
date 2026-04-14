-- Informe: Ventas por Categoría (MercadoLibre)
-- Incluye: Unidades y Monto, período principal y comparado
-- Filtros opcionales: Categoría y Local

-- DECLARACIÓN DE VARIABLES
DECLARE @FechaDesde DATE = '{fecha_desde}';
DECLARE @FechaHasta DATE = '{fecha_hasta}';

DECLARE @FechaComparadoDesde DATE = {fecha_comparado_desde}; -- puede ser NULL
DECLARE @FechaComparadoHasta DATE = {fecha_comparado_hasta}; -- puede ser NULL

DECLARE @Categoria VARCHAR(100) = {categoria}; -- puede ser NULL
DECLARE @Local VARCHAR(MAX) = {local};          -- puede ser NULL

-- CONSULTA
SELECT
    v.CATEGORY_NAME AS CATEGORIA,

    /* =========================
       PERÍODO PRINCIPAL
       ========================= */

    -- Unidades vendidas
    SUM(
        CASE
            WHEN v.DATE_CREATED >= @FechaDesde
             AND v.DATE_CREATED < DATEADD(DAY, 1, @FechaHasta)
            THEN v.CANTIDAD
            ELSE 0
        END
    ) AS UNIDADES,

    -- Monto vendido
    SUM(
        CASE
            WHEN v.DATE_CREATED >= @FechaDesde
             AND v.DATE_CREATED < DATEADD(DAY, 1, @FechaHasta)
            THEN v.TOTAL_AMOUNT
            ELSE 0
        END
    ) AS VENTAS,

    /* =========================
       PERÍODO COMPARADO
       ========================= */

    -- Unidades comparadas
    CASE
        WHEN @FechaComparadoDesde IS NOT NULL
         AND @FechaComparadoHasta IS NOT NULL
        THEN
            SUM(
                CASE
                    WHEN v.DATE_CREATED >= @FechaComparadoDesde
                     AND v.DATE_CREATED < DATEADD(DAY, 1, @FechaComparadoHasta)
                    THEN v.CANTIDAD
                    ELSE 0
                END
            )
        ELSE NULL
    END AS UNIDADES_COMPARADO,

    -- Monto comparado
    CASE
        WHEN @FechaComparadoDesde IS NOT NULL
         AND @FechaComparadoHasta IS NOT NULL
        THEN
            SUM(
                CASE
                    WHEN v.DATE_CREATED >= @FechaComparadoDesde
                     AND v.DATE_CREATED < DATEADD(DAY, 1, @FechaComparadoHasta)
                    THEN v.TOTAL_AMOUNT
                    ELSE 0
                END
            )
        ELSE NULL
    END AS VENTAS_COMPARADO

FROM VENTAS_MERCADOLIBRE v
WHERE
    v.ESTADO = 'VENTA_COMPLETADA'

    -- Filtro opcional por Categoría
    AND (v.CATEGORY_NAME = @Categoria OR @Categoria IS NULL)

    -- Filtro opcional por Local
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR v.LOCAL IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )

GROUP BY
    v.CATEGORY_NAME
ORDER BY
    v.CATEGORY_NAME;
