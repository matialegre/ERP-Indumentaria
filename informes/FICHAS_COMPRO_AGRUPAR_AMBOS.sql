-- Informe: Resumen Global de Compras (Todos los Locales en 1 sola fila)
-- Parámetros: @FechaInicio, @FechaFin, @Local

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};

WITH SS AS (
    SELECT 
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
),
ST AS (
    SELECT 
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
)
SELECT 
    @FechaInicio AS FECHA_DESDE,
    @FechaFin AS FECHA_HASTA,
    COALESCE(@Local, 'TODOS LOS LOCALES') AS AMBITO,
    ST.TOTAL AS TOTAL_OPERACIONES_GLOBAL, 
    COALESCE(SS.COMPRAS, 0) AS COMPRAS_EFECTIVAS_GLOBAL, 
    CASE 
        WHEN ST.TOTAL = 0 THEN 0 
        ELSE (COALESCE(SS.COMPRAS, 0) * 100.0) / ST.TOTAL 
    END AS PORCENTAJE_CONVERSION_GLOBAL 
FROM ST, SS;
