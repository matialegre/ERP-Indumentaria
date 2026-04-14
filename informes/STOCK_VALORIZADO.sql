DECLARE @Marca NVARCHAR(100) = {marca};
DECLARE @Proveedor NVARCHAR(200) = {proveedor};
DECLARE @Locales NVARCHAR(MAX) = {local};

-- 1. Definimos una tabla temporal con datos únicos
WITH StocksUnicos AS (
    SELECT DISTINCT 
        CODIGO_ARTICULO, 
        CODIGO_COLOR, 
        CODIGO_TALLE, 
        LOCAL, 
        STOCK, 
        COSTO, 
        MARCA, 
        PROVEEDOR
    FROM STOCKS
)

-- 2. Realizamos el cálculo sobre la tabla limpia
SELECT
    REPLACE(LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CAST(STOCK AS DECIMAL(18, 4)) * ISNULL(CAST(COSTO AS DECIMAL(18, 4)), 0)
    ) AS VALOR_TOTAL
FROM StocksUnicos
WHERE (@Marca IS NULL OR @Marca = '' OR MARCA = @Marca)
  AND (@Proveedor IS NULL OR @Proveedor = '' OR PROVEEDOR = @Proveedor)
  AND (
        @Locales IS NULL OR LTRIM(RTRIM(@Locales)) = ''
        -- Filtramos sobre el nombre limpio del local
        OR REPLACE(LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Locales, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
      )
GROUP BY REPLACE(LOCAL, 'DRAGONFISH_', '')
ORDER BY LOCAL;