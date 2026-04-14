-- Informe: Resumen de Compras por Local (Período Completo)
-- Parámetros: @FechaInicio, @FechaFin, @Local

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};

WITH SS AS (
    SELECT 
        LOCAL, 
        COUNT(COMPRO) AS COMPRAS 
    FROM FICHACOMPRO 
    WHERE COMPRO = 'SI'
      AND CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND (
            @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
            OR LOCAL IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Local, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
    GROUP BY LOCAL
),
ST AS (
    SELECT 
        LOCAL, 
        COUNT(*) AS TOTAL 
    FROM FICHACOMPRO 
    WHERE CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND (
            @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
            OR LOCAL IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Local, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
    GROUP BY LOCAL
)
SELECT 
    ST.LOCAL, 
    @FechaInicio AS DESDE,
    @FechaFin AS HASTA,
    ST.TOTAL AS TOTAL_OPERACIONES, 
    COALESCE(SS.COMPRAS, 0) AS COMPRAS_EFECTIVAS, 
    CASE 
        WHEN ST.TOTAL = 0 THEN 0 
        ELSE (COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL 
    END AS PORCENTAJE_CONVERSION 
FROM ST 
LEFT JOIN SS ON SS.LOCAL = ST.LOCAL
ORDER BY PORCENTAJE_CONVERSION DESC;
