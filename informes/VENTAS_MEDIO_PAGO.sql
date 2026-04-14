DECLARE @FechaInicio DATE = '{fecha_inicio}';
DECLARE @FechaFin DATE = '{fecha_fin}';
DECLARE @Local VARCHAR(MAX) = {local};
DECLARE @MedioPago VARCHAR(50) = {medio_pago};

SELECT 
    v.FECHA_DIA AS FECHA,
    ISNULL(mp.FORMAPAGODETALLE, 'Sin Especificar') AS MEDIO_PAGO,
    REPLACE(mp.LOCAL, 'DRAGONFISH_', '') AS LOCAL,
    SUM(
        CASE 
            WHEN mp.COMPROBANTE_TIPO = 'AUTOCONS' OR mp.COMPROBANTE_TIPO LIKE 'NCR%' 
            THEN -mp.MONTOPAGO 
            ELSE mp.MONTOPAGO 
        END
    ) AS MONTO_VENDIDO
FROM MEDIOS_PAGOS mp
INNER JOIN (
   
    SELECT 
        IDVENTA,
        LOCAL,
        CAST(MIN(FECHA) AS DATE) AS FECHA_DIA
    FROM VENTAS
    GROUP BY IDVENTA, LOCAL
) v ON v.IDVENTA = CONVERT(VARCHAR(50), mp.IDVENTA) 
   AND v.LOCAL = mp.LOCAL
WHERE 
    v.FECHA_DIA BETWEEN @FechaInicio AND @FechaFin
    AND (
        @Local IS NULL OR LTRIM(RTRIM(@Local)) = ''
        OR REPLACE(mp.LOCAL, 'DRAGONFISH_', '') IN (
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@Local, ',')
            WHERE LTRIM(RTRIM(value)) <> ''
        )
    )
    AND (mp.FORMAPAGODETALLE = @MedioPago OR @MedioPago IS NULL)
GROUP BY 
    v.FECHA_DIA,
    ISNULL(mp.FORMAPAGODETALLE, 'Sin Especificar'),
    REPLACE(mp.LOCAL, 'DRAGONFISH_', '')
ORDER BY 
    FECHA DESC, 
    MONTO_VENDIDO DESC;