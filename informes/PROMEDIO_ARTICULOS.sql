-- Informe: Totales por Local (Filtrado por Marca y Precio)
-- Parámetros: @FechaInicio, @FechaFin, @Local, @Marca

-- DECLARACIÓN DE VARIABLES
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca VARCHAR(50) = {marca};

-- CONSULTA
SELECT 
    'del ' + CONVERT(VARCHAR, @FechaInicio, 103) + ' al ' + CONVERT(VARCHAR, @FechaFin, 103) AS PERIODO,
    LOCAL,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_ARTICULOS,
    
    -- Identificación única del ticket: Concatenación de Local, Número y Tipo
    COUNT(DISTINCT LOCAL + '-' + CAST(COMPROBANTE_NUMERO AS VARCHAR) + '-' + COMPROBANTE_TIPO) AS TOTAL_TICKETS

FROM VENTAS
WHERE 
    -- Filtro de Fechas
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
    
    -- Filtro de Precio (Mayor a 100)
    AND PRECIO_unidad > 100

    -- Filtro de Comprobantes Válidos
    AND (
        COMPROBANTE_TIPO LIKE 'FACTURA%' 
        OR COMPROBANTE_TIPO LIKE 'TIQUE%' 
        OR COMPROBANTE_TIPO LIKE 'TKF%'
    )

    -- Filtros de Parámetros
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )
    AND (@Marca IS NULL OR MARCA = @Marca)

GROUP BY 
    LOCAL
ORDER BY 
    TOTAL_ARTICULOS DESC;
