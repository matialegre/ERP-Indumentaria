-- Informe: Evolución Diaria Global (Todos los locales sumados por día)
-- Parámetros: @FechaInicio, @FechaFin, @Local

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};

WITH SS AS (
    SELECT 
        CAST(FECHA AS DATE) AS FECHA_DIA, 
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
    GROUP BY CAST(FECHA AS DATE)
),
ST AS (
    SELECT 
        CAST(FECHA AS DATE) AS FECHA_DIA, 
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
    GROUP BY CAST(FECHA AS DATE)
)
SELECT 
    ST.FECHA_DIA, 
    COALESCE(@Local, 'TODOS LOS LOCALES') AS AMBITO,
    ST.TOTAL AS TOTAL_OPERACIONES_DIA, 
    COALESCE(SS.COMPRAS, 0) AS COMPRAS_EFECTIVAS_DIA, 
    CASE 
        WHEN ST.TOTAL = 0 THEN 0 
        ELSE (COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL 
    END AS PORCENTAJE_DIARIO 
FROM ST 
LEFT JOIN SS ON SS.FECHA_DIA = ST.FECHA_DIA
ORDER BY ST.FECHA_DIA ASC;
