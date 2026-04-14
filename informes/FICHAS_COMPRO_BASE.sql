-- Informe: Porcentaje de Compras por Local y Fecha
-- Parámetros: @FechaInicio, @FechaFin, @Local

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};

WITH SS AS (
    SELECT 
        LOCAL, 
        FECHA, 
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
    GROUP BY LOCAL, FECHA
),
ST AS (
    SELECT 
        LOCAL, 
        FECHA, 
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
    GROUP BY LOCAL, FECHA
)
SELECT 
    ST.LOCAL, 
    ST.FECHA, 
    ST.TOTAL, 
    COALESCE(SS.COMPRAS, 0) AS COMPRAS, 
    CASE 
        WHEN ST.TOTAL = 0 THEN 0 
        ELSE (COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL 
    END AS PORCENTAJE 
FROM ST 
LEFT JOIN SS ON SS.LOCAL = ST.LOCAL AND SS.FECHA = ST.FECHA
ORDER BY ST.FECHA DESC, ST.LOCAL ASC;
