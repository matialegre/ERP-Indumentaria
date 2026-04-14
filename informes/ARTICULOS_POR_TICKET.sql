-- Informe: Artículos por Comprobante con Vendedor
-- Parámetros: @FechaInicio, @FechaFin, @Local, @MinArticulos

-- DECLARACIÓN DE VARIABLES
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @MinArticulos INT = {min_articulos};

-- CONSULTA
SELECT
    MIN(CAST(FECHA AS DATE)) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    VENDEDOR,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO,
    -- Aplicación de signo negativo para NCR y AUTOCONS
    SUM(
        CASE 
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
            THEN -1 
            ELSE 1 
        END
    ) AS CANTIDAD_ARTICULOS
FROM VENTAS
WHERE 
    -- Filtro de Fechas
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
    
    -- Filtro de Precio
    AND PRECIO_UNIDAD > 10

    -- Filtro de Vendedor (Limpieza)
    AND VENDEDOR IS NOT NULL 
    AND VENDEDOR <> 'Sin Vendedor'
    AND VENDEDOR <> ''

    -- Filtro Opcional de Local
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )

GROUP BY
    REPLACE(LOCAL, 'DRAGONFISH_', ''),
    VENDEDOR,
    COMPROBANTE_NUMERO,
    COMPROBANTE_TIPO
HAVING 
    COUNT(*) >= @MinArticulos 
ORDER BY 
    FECHA DESC, 
    LOCAL ASC;