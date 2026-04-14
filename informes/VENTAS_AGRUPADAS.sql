-- Informe: Ventas Totales por Día y Local
-- Parámetros: @FechaInicio, @FechaFin, @Local

-- DECLARACIÓN DE VARIABLES
DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};

-- CONSULTA
SELECT 
    CAST(FECHA AS DATE) AS FECHA,
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    -- Aplicación de signo negativo para NCR y AUTOCONS
    SUM(
        CASE 
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
            THEN CANTIDAD_VENDIDA * -1 
            ELSE CANTIDAD_VENDIDA 
        END
    ) AS CANTIDAD_VENDIDA,
    SUM(
        CASE 
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO LIKE 'NCR%' 
            THEN MONTO_VENTA_NETO_IVA * -1 
            ELSE MONTO_VENTA_NETO_IVA 
        END
    ) AS MONTO_VENDIDO,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO LIKE 'TKF%' OR COMPROBANTE_TIPO = 'TIQUE'
            THEN CONCAT(
                REPLACE(LOCAL, 'DRAGONFISH_', ''), '|',
                COMPROBANTE_TIPO, '|',
                CONVERT(VARCHAR(100), COMPROBANTE_NUMERO)
            )
            ELSE NULL
        END
    ) AS CANTIDAD_FACTURAS,
    COUNT(DISTINCT
        CASE
            WHEN COMPROBANTE_TIPO = 'AUTOCONS' OR COMPROBANTE_TIPO = 'AUTOCON' OR COMPROBANTE_TIPO LIKE 'NCR%'
            THEN CONCAT(
                REPLACE(LOCAL, 'DRAGONFISH_', ''), '|',
                COMPROBANTE_TIPO, '|',
                CONVERT(VARCHAR(100), COMPROBANTE_NUMERO)
            )
            ELSE NULL
        END
    ) AS CANTIDAD_NOTA_CREDITO
FROM VENTAS
WHERE 
    -- Filtro de Fechas
    CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
    

    -- Filtro de Local Opcional
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )

GROUP BY 
    CAST(FECHA AS DATE),
    REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY 
    FECHA DESC, 
    MONTO_VENDIDO DESC;