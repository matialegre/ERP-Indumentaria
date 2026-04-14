-- Informe: Ventas Limpias por Artículo con Filtros Avanzados
-- Parámetros: @FechaInicio, @FechaFin, @Local, @Marca

DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @Marca NVARCHAR(100) = {marca};

WITH VentasFiltradas AS (
    SELECT
        LOCAL,
        CODIGO_ARTICULO,
        TRIM(
            CASE
                WHEN CHARINDEX(' Variante', ARTICULO_DESCRIPCION) > 0
                THEN LEFT(ARTICULO_DESCRIPCION, CHARINDEX(' Variante', ARTICULO_DESCRIPCION) - 1)
                ELSE ARTICULO_DESCRIPCION
            END
        ) AS ARTICULO_LIMPIO,
        CANTIDAD_VENDIDA
    FROM VENTAS
    WHERE CAST(FECHA AS DATE) BETWEEN @FechaInicio AND @FechaFin
      AND (
            @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
            OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
                SELECT LTRIM(RTRIM(value))
                FROM STRING_SPLIT(@Local, ',')
                WHERE LTRIM(RTRIM(value)) <> ''
            )
          )
      AND (@Marca IS NULL OR @Marca = '' OR MARCA = @Marca)
      AND UPPER(CODIGO_ARTICULO) NOT IN (
          'AJUSTE',
          'NRMPBSABS6NB0ST',
          'NRMPBSABS2',
          '1',
          '3',
          'PTF3539APCOUT',
          'PTF4539APCOUT',
          'PTR2530APCOUT',
          'PTF7050APCOUT',
          'DESCUENTO',
          'NRMPBSABS1',
          'NRMPBSABS5',
          '2'
      )
)

SELECT
    LOCAL,
    CODIGO_ARTICULO,
    ARTICULO_LIMPIO,
    SUM(CANTIDAD_VENDIDA) AS TOTAL_VENDIDO
FROM VentasFiltradas
GROUP BY
    LOCAL,
    CODIGO_ARTICULO,
    ARTICULO_LIMPIO
ORDER BY SUM(CANTIDAD_VENDIDA) DESC;
