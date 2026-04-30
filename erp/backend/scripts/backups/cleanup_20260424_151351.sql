--
-- PostgreSQL database dump
--

\restrict UO2SGNJl0wUlLb8HSHVdkJy5m5qP1E5XXV6kX7Nx9dqroN5KFA65dvVx2GEAwdk

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: locals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.locals (id, name, code, address, phone, is_active, company_id, created_at, updated_at) FROM stdin;
19	Montagne Córdoba	MONTAGNE_CÓRDOBA	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
20	Montagne Neuquén Alberdi	MONTAGNE_NEUQUÉN_ALB	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
21	Neuquén Shop La Anónima	NEUQUÉN_SHOP_LA_ANÓN	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
22	Montagne Comahue	MONTAGNE_COMAHUE	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
23	Montagne Roca	MONTAGNE_ROCA	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
24	Mundo Roca	MUNDO_ROCA	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
25	Montagne Mar del Plata	MONTAGNE_MAR_DEL_PLA	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
26	Montagne Juan B. Justo	MONTAGNE_JUAN_B._JUS	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
27	Montagne NE	MONTAGNE_NE	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
28	Mundo Palermo	MUNDO_PALERMO	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
29	Montagne BB Paseo del Sol	MONTAGNE_BB_PASEO_DE	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
30	Montagne BB Local	MONTAGNE_BB_LOCAL	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
31	Mundo Alem	MUNDO_ALEM	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
32	Mundo BB Paseo del Sol	MUNDO_BB_PASEO_DEL_S	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
33	Rancho	RANCHO	\N	\N	t	3	2026-03-27 15:32:52.024709-03	2026-03-27 15:32:52.024709-03
34	Montagne Villa María	MTG_VILLA_MARIA	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
35	Montagne General Roca	MTG_GRL_ROCA	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
36	Mundo Outdoor General Roca	MUNDO_GRL_ROCA	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
37	Mundo Outdoor Bahía Blanca San Martín	MUNDO_BB_SM	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
38	Mundo Outdoor Bahía Blanca Plaza Shopping	MUNDO_BB_PLAZA	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
39	Montagne Neuquén Centro	MTG_NQN_CENTRO	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
40	Neuquén Shopping Alto Comahue	NQN_ALTOCOMAHUE	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
41	Neuquén Shopping Paseo de la Patagonia	NQN_PASEOPATAGONIA	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
42	Montagne Mar del Plata Güemes	MTG_MDP_GUEMES	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
43	Montagne Mar del Plata Juan B. Justo	MTG_MDP_JBJ	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
44	Montagne Buenos Aires	MTG_BSAS	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
45	Depósito Central	DEPOSITO_CENTRAL	\N	\N	t	3	2026-03-27 16:03:33.760431-03	2026-03-27 16:03:33.760431-03
\.


--
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.providers (id, name, cuit, contact_name, phone, email, address, notes, is_active, company_id, created_at, updated_at, legal_name, tax_id_type, tax_condition, gross_income, domicilio, cp, localidad, provincia, pais, vendor_name, fax, ret_iva_pct, ret_iibb_pct, ret_ganancias_pct, ret_suss_pct, days_alert_sin_rv, logo_filename, tango_code, order_prefix, brands) FROM stdin;
379	PRUEBA	\N	\N	\N	\N	\N	\N	f	3	2026-03-31 17:58:24.990904-03	2026-03-31 17:58:24.990904-03	\N	\N	\N	\N	\N	\N	\N	\N	Argentina	\N	\N	0.0000	0.0000	0.0000	0.0000	0	\N	\N	PRUEBA	\N
314	Miding S.R.L - BHI	30708565594	\N	1123762620	Asistenteventas@montagne.com.ar	Vieytes nº 1661- Piso 3	Razón social: 847\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 2	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Miding
315	Miding S.R.L - CABA	30708565594	\N	\N	\N	Vieytes nº 1661- Piso 3 1275	Razón social: 906994\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 70	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Miding
316	Miding S.R.L - MDQ JBJ/Guemes	30708565594	\N	\N	\N	Vieytes nº 1661- Piso 3 1275	Razón social: 611140\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 37	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Miding
317	Miding S.R.L - Neuquen	30708565594	\N	\N	\N	Vieytes nº 1661- Piso 3 1275	Razón social: 818330\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 40	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Miding
318	Miding S.R.L - VMC	30708565594	\N	\N	\N	Vieytes nº 1661- Piso 3 1275	Razón social: 810871\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 39	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Miding
321	Montagne Outdoors S.A - BHI	30522982225	\N	1123762620	Asistenteventas@montagne.com.ar	Av.Cordoba nº 5371	Razón social: 11332\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 1\nCódigo Tango: 1	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Montagne
322	Montagne Outdoors S.A - CABA	30522982225	\N	\N	\N	Av.Cordoba nº 5371 1414	Razón social: 213804\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 71	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Montagne
323	Montagne Outdoors S.A - MDQ	30522982225	\N	1123762620	Asistenteventas@montagne.com.ar	Av.Cordoba nº 5371	Razón social: 23971\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 1\nCódigo Tango: 28	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Montagne
324	Montagne Outdoors S.A - NQN	30522982225	\N	1123762620	\N	Av.Cordoba nº 5371 1414	Razón social: 21355\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 34	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Montagne
325	Montagne Outdoors S.A - VMC	30522982225	\N	1123762620	\N	Av.Cordoba nº 5371 1414	Razón social: 66845\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 33	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Montagne
331	OMBAK	\N	\N	\N	\N	\N	\N	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	OMBAK
380	MIDING S.R.L.	\N	\N	\N	\N	\N	\N	f	3	2026-03-31 17:58:24.990904-03	2026-04-21 10:40:01.395756-03	MIDING S.R.L.	\N	\N	\N	\N	\N	\N	\N	Argentina	\N	\N	0.0000	0.0000	0.0000	0.0000	0	\N	\N	MIDING-S.R.L.	Miding
199	A.Mutual Mercantil Argentina	30593049554	\N	\N	\N	L.de la Torre nº 72 5900	Localidad: Villa Maria\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 30	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
200	ANELPA SRL	30710401531	\N	\N	\N	NAZCA 11278 1417	Localidad: Ciudad de Buenos Aires\nProvincia: Buenos Aires\nCondición: 1\nCódigo Tango: 166	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
201	Aadi Capif A.C.R	30574449967	\N	\N	\N	H. Yrigoyen nº 1628 - P 6 1089	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 78	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
202	Alvarez Cortina Martin Alejand	20306733924	\N	\N	\N	Alsina 223 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 144	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
203	Alvit Group S.A	30715633074	\N	\N	\N	Av.del Libertador nº 5990 P 12 Of 1203 1428	Razón social: Nawa\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 151	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
204	Andreoli Impresos	20054797193	\N	\N	\N	Donado 79 8000	Razón social: Moral Oscar Guillermo\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 148	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
205	Argentaurus S.R.L	30708407751	\N	\N	\N	Colon nº 560 1646	Localidad: Fernando Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 127	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
206	Ariel Papasodero	20231812904	\N	\N	\N	Ruta 9 KM 554 5900	Razón social: LDC Logistica del centro\nLocalidad: Villa Maria Cordoba\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 150	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
207	Ashi S.A	30715911201	\N	1168414142	hola@ashi.group	11 de Setiembre de 1888 nº 1555	Razón social: Waterdog\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 17	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
208	Baffetti Eduardo Luis	20141096258	\N	\N	\N	Pte Illia 8790 1615	Localidad: Grand Bourg\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 128	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
209	Bahia Blanca Plaza Shopping SA	30688117417	\N	2914594100	\N	Sarmiento nº 2153 8000	Razón social: Loc 135 - Montagne\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 20	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
210	Bahia Blanca Plaza Shopping SA	30688117417	\N	\N	\N	Sarmiento nº 2153 8000	Razón social: Loc 199 - Mundo Outdoor\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 176	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
211	Bahia Jugos S.R.L	30639014149	\N	2110100	\N	Montevideo nº 1550 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 57	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
212	Be Outside S.A	30716520923	\N	\N	\N	Migueletes nº 1646 P 1 1426	Razón social: Hi-Tec\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 155	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
213	Boccardo Claudia Carolina	27225002784	\N	\N	\N	N 3 170 6600	Razón social: Tapetes Argentinos\nLocalidad: Mercedes\nProvincia: Buenos Aires\nCondición: 1\nCódigo Tango: 163	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
214	Boero Carlos Sebastian	20286638202	\N	\N	\N	Lavalle nº 363 8000	Razón social: Laser Bahia\nLocalidad: Bahia Blanca\nProvincia: Bs As\nCondición: 0\nCódigo Tango: 88	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
215	Boro Bahia SRL	30709634441	\N	\N	\N	San Martin 424 8000	Razón social: STOP\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 120	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
216	Boscomet SA	30715185616	\N	\N	\N	Av Pedro Cabrera 4450 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 104	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
217	Bracklo Guillermo Daniel	20132074950	\N	\N	\N	Av.Argentina nº 129 8153	Localidad: Monte Hermoso\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 43	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
218	Brogas S.A	30515676178	\N	1145538383	brogas@brogas.com	Dr.Rafael Bielsa nº 142	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 7	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
219	CALZADOS BLANCO	\N	\N	\N	\N	\N	Razón social: CALZADOS BLANCO S.A.	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
220	CCL Lable SRL	30714016446	\N	\N	\N	Costa Rica 5379 1667	Razón social: Checkpoint\nLocalidad: Tortuguitas Norte\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 119	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
221	CRISTOBAL COLON	\N	\N	\N	\N	\N	Razón social: CRISTOBAL COLON S.R.L.	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
222	Calf	30545721399	\N	\N	\N	B. Mitre N° 609 8300	Localidad: Neuquen\nProvincia: Neuquen\nCondición: 0\nCódigo Tango: 122	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
223	Calzados Blanco S.A	30707450394	\N	\N	\N	Junin nº 191 Piso 13 Dto 2 2000	Localidad: Rosario Norte\nProvincia: Santa Fe\nCondición: 0\nCódigo Tango: 89	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
224	Calzados Gunar S.A.	33715134689	\N	\N	\N	Junin nº 191 Piso 15 Dto 3-4 2000	Localidad: Rosario Norte\nProvincia: Santa Fe\nCondición: 0\nCódigo Tango: 77	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
225	Campamento S.A	30614257292	\N	2645445531	julieta@ansilta.com	Necochea nº 2085	Localidad: Santa Lucia\nProvincia: San juan\nCondición: 0\nCódigo Tango: 10	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
226	Carlos Islas y Cia SA	30529046576	\N	\N	\N	San Juan 198 8332	Razón social: Carlos Islas\nLocalidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 124	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
227	Casali Sergio Eduardo	20128624431	\N	\N	\N	Namuncura 562 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 162	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
228	Catalgas SA	30716280507	\N	\N	\N	Moreno 290 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 132	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
229	Caudia Carreño	27275378602	\N	\N	\N	Soler 501 8000	Razón social: Holding Bahia\nLocalidad: Blahia Blanca\nProvincia: Buenos Aires\nCondición: 1\nCódigo Tango: 172	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
230	Cencosud SA	30590360763	\N	\N	\N	Capitan Jose Matinez 8000	Razón social: EASY\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 106	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
231	Centro del Trabajo	30708270101	\N	\N	\N	Thompson nº 537 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 82	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
232	Chricer S.A	\N	\N	\N	\N	O´higgins 1331 8000	Código Tango: 118	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
233	Ciarrocchi Hnos	33688082159	\N	\N	\N	Panama 1837 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 140	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
349	Salinas Rodolfo Usain	20236484166	\N	\N	\N	Cipolletti 1349 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 117	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
234	Ciudadela S.R.L	30502378674	\N	\N	\N	Av Libertador nº 1295 1638	Localidad: Vicente Lopez\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 153	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
235	Clear SAle Argentina SRL	33718573829	\N	33718573829	\N	Tucuman 1 piso 4 1049	Razón social: Clear Sale\nLocalidad: Ciudad de Buenos Aires\nProvincia: Buenos Aires\nCondición: 1.0\nCódigo Tango: 169	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
236	Clesmar S.A	\N	\N	\N	\N	Migueletes 1646 nº Piso 1	Código Tango: 19	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
237	Club Naposta	30707160868	\N	\N	\N	Av.Alem nº 328 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 96	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
238	Codimat SA	30540889356	\N	\N	\N	Don Bosco 1495 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 94	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
239	ColorShop SRL	30714362328	\N	\N	\N	Sarmiento 698 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 99	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
240	Colorama	20082132628	\N	\N	\N	Sisando de la torre 90 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 149	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
241	Comercial Bahia Blanca	30707811257	\N	\N	\N	Av. Sarmiento 8000	Razón social: Comercial BB\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 85	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
242	Complementos Electricos SRL	30709659371	\N	\N	\N	Estados Unidos 897 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 125	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
243	Comprandoengrupo.net S.A	30712116818	\N	3514284576	\N	Maipu nº 479	Localidad: Cordoba\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 9	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
244	Condominio Lemos Ricardo y otr	30707675876	\N	\N	\N	Alsina nº 135 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 44	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
245	Copit S.A.S	33716250569	\N	1170187725	odoo16@salpa.com.ar	Uspallata nº 2106	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 14	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
246	Correo Andreani S.A	33699685459	\N	\N	\N	Av. Leandro Alem nº 639 7° 1001	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 45	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
247	Correo Argentino S.A	30708574836	\N	\N	\N	Av.J.de la Rosa nº 223 5400	Localidad: Juan San\nProvincia: Juan Argentina\nCondición: 0\nCódigo Tango: 36	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
248	Cotillon Amoroso	33707810179	\N	\N	\N	Chiclana 214 8000	Razón social: Cotimax Bahia SA\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 112	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
249	Cristobal Colon S.R.L	30634144028	\N	\N	\N	Av. Cordoba nº 373 P 6 Dpto C 1054	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 73	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
250	D LED SH	30710730845	\N	\N	\N	Juan b Justo Av 2075 1414	Razón social: Demasled\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 135	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
251	DG Distribution S.R.L	30715352563	\N	\N	\N	Angel Carranza nº 2235 P: PB 1425	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 86	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
252	Davitel S.A	30709391379	\N	\N	\N	San Martin nº 2970 8300	Localidad: Neuquen\nProvincia: Neuquen\nCondición: 0\nCódigo Tango: 56	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
253	De Minicis Silvia Beatriz	27166811223	\N	\N	\N	Undiano 51 8000	Localidad: BAHIA BLANCA - DISTRIBUCION -\nProvincia: BUENOS AIRES\nCondición: 1\nCódigo Tango: 168	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
254	Despegar	30701307115	\N	\N	\N	Av. Jujuy 2013 1247	Localidad: Buenos Aires Argentina\nCondición: 0\nCódigo Tango: 142	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
255	D´Albenas Peyronel Silvana	27924079008	\N	\N	\N	Gualeguaychu Golf Club nº 1647 1669	Razón social: Rapiestantes\nLocalidad: Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 147	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
256	EMPRESA PROV ENERGIA CORDOBA	30999027489	\N	\N	\N	LA TABLADA 350 X 5007	Razón social: E P E C\nLocalidad: CORDOBA\nProvincia: CORDOBA\nCondición: 1\nCódigo Tango: 167	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
257	Ecoklima	30707158979	\N	\N	\N	Fraga 246 1427	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 126	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
258	Edes S.A	30693834585	\N	\N	\N	Moreno 79 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 123	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
259	Embalplast SA	30695930573	\N	2914552655	\N	San Martin nº 558 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 84	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
260	Empresa de Energia de Rio Negr	30689541166	\N	\N	\N	Alvear 298 8500	Razón social: EDERSA\nLocalidad: Viedma\nProvincia: Rio Negro\nCondición: 1\nCódigo Tango: 174	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
261	Energi Alem de Hait Jose Luis	\N	\N	\N	\N	Avenida Alem 2070 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCódigo Tango: 105	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
262	Escribania Bochile	27206919391	\N	\N	\N	Caronti nº 507 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 80	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
263	Espinosa Maria Florencia	27376627670	\N	\N	\N	Fabian Gonzalez nº 750 P 2 Dto 9 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 66	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
264	Esteva Horacio Marcelo	20243922047	\N	\N	\N	Belgrano nº 1581 Dpto 2 8332	Localidad: Roca Rio Negro\nProvincia: Argentina\nCondición: 0\nCódigo Tango: 101	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
265	Estudio Laser	30677762272	\N	\N	\N	Tucuman 1757 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 129	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
266	Expreso Naposta SA	30711409951	\N	\N	\N	Av General Roca 3450 1872	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 91	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
267	FLORIDA IMPORTA	\N	\N	\N	\N	\N	Razón social: FLORIDA IMPORTA S.A.	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
268	FRH	30711763879	\N	\N	\N	Galileo 2960 1702	Razón social: Eduardo H\nLocalidad: Ciudadela\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 139	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
269	Ferre Shop	30718111087	\N	\N	\N	14 de Julio 2857 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 102	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
270	FerreiraSport SA	30710132670	\N	\N	\N	8000	Razón social: Ferreira Sport\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 1\nCódigo Tango: 165	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
271	Ferreteria Centro	20055147508	\N	\N	\N	Estomba 402 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 114	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
272	Ferrin Damian Ricardo	20241125506	\N	\N	\N	Jose Bianco nº 495 1684	Localidad: Palomar Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 54	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
273	Fideicomiso Rolamar	30710923651	\N	\N	\N	Rawson nº 3236 7600	Localidad: Mar del Plata Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 46	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
274	Financor S.A	30560443265	\N	\N	\N	Independencia nº 1740 P 1 Dto A 7600	Localidad: del Plata Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 180	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
275	Florida Importa S.A	33709075549	\N	\N	\N	Estanislao del Campo nº 1850 1604	Razón social: Burton\nLocalidad: Florida\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 68	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
276	Forever Surfing SRL	30714665959	\N	\N	\N	Cornelio Saavedra nº 3150 7600	Localidad: del Plata Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 98	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
277	Forneris Diego Agustin	20375519268	\N	\N	\N	Undiano nº 51 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 65	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
278	Francisco Lonas S.R.L.	30712376615	\N	\N	\N	Parchape 1056 8000	Localidad: Bahía Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 159	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
279	GARRONE OCTAVIO JAVIER	20220532152	\N	\N	\N	ANGEL BRUNEL 1298 8000	Razón social: BROKER GO!¡ FOTO\nLocalidad: BAHIA BLANCA\nProvincia: BUENOS AIRES\nCondición: 1\nCódigo Tango: 173	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
280	Garcia Maximo Antonio	20119296502	\N	\N	\N	Republica del Libano nº 1607 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 53	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
281	Gili y Cia S.R.L	30561289278	\N	2914565300	\N	Rondeau y Sixto Laspiur 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 23	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
282	Gmc Cargo S.R.L	30716636050	\N	\N	\N	Reconquista nº1034 P 4 1003	Razón social: Lic. German Corradini\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 157	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
283	Grupo Weis S.A	30715158902	\N	2110100	\N	Cabildo nº 480	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 15	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
284	Grupuk S.R.L	30711279624	\N	1130887788	rocio@ombak.com.ar	Libertad nº 1584	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 4	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
285	Guspamar S.A	30601496867	\N	\N	\N	Av.Colon nº 845 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 69	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
286	Himeba	30592711857	\N	\N	\N	Av. Parchape 1004 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 115	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
287	Himeba S.R.L	30592711857	\N	\N	\N	Av.Parchape nº 1004 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 55	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
288	Imarne SRL	33709863849	\N	\N	\N	NEWTON 2151 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 141	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
289	Importodooeste SRL	30716099462	\N	\N	\N	Marcelo Gamboa 6151 1408	Razón social: EquiHome\nLocalidad: Versalles\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 134	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
290	Indeplac SRL	30717135306	\N	\N	\N	8000	Razón social: Sistemas Constructivos en Seco\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 97	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
291	Interprovincial S.R.L	30648021360	\N	2914882030	\N	Don Bosco nº 2255 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 21	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
292	Irsa	\N	\N	\N	\N	Della Paolera Carlos nº 261 Piso 8 1001	Código Tango: 32	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
293	Jai Group S.A	30715534971	\N	\N	\N	Dr. Belaustegui nº 3840 1407	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 67	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
294	Juan Ignacio De Victoria	20372353229	\N	\N	\N	Gallego Mora nº 2074 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 64	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
295	K.F.Latin America S.R.L.	30716928485	\N	\N	\N	Talcahuano nº 452 Piso 7 Dpto 29 1013	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 24	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
296	Kadima S.A	30707337628	\N	\N	\N	Tucuman nº 552 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 138	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
297	Kaufmann Silvina Paola y Virgi	30708820365	\N	\N	\N	Salguero Jeronimo nº 1521 P 7 Dpto 28 1177	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 130	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
298	Kodiak Tex S.A.S	30716086298	\N	2110100	\N	Thames nº 1031	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 3	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
299	Kudos Estudio S.R.L	30715500686	\N	\N	\N	Av.Colon nº 6200 5000	Localidad: Cordoba\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 42	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
300	La Aero-Via BHI SRL	30716883945	\N	\N	\N	Autovia Juan Pablo II 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 109	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
301	La Papeleria	27200451681	\N	\N	\N	San Martin 116 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 95	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
302	La Tapera S.A	30629812918	\N	\N	\N	Av.Argentina nº 197 8300	Localidad: Neuquen\nProvincia: Neuquen\nCondición: 0\nCódigo Tango: 35	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
303	Lago S.A.	30625592328	\N	\N	\N	Gorriti nº 48 8000	Razón social: Stylo Urbano\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 62	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
304	Lara Mora S.A	30710132182	\N	\N	\N	Yrigoyen nº 536 Piso 3 Dto B 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 47	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
305	Lunghi Daniel Alejandro	\N	\N	\N	\N	España 702 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCódigo Tango: 133	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
306	MMZARA SAS	30717143422	\N	\N	\N	MEXICO 968 5105	Razón social: KUDOS COMMERCE\nLocalidad: VILLA ALLENDE\nProvincia: CORDOBA\nCondición: 1\nCódigo Tango: 175	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
307	Mad Distribution S.A	30716175541	\N	\N	\N	Estados Unidos nº 1055 1602	Razón social: Circa\nLocalidad: Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 179	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
308	Mansilla Fernanda Gabriela	27232609163	\N	\N	\N	Magallanes nº 5256 7600	Localidad: del Plata Sur Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 48	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
309	Marparaiso SA	30717503194	\N	\N	\N	General Paz 2621 7602	Localidad: del Plata SUR Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 145	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
310	Martha	\N	Julio 11-54914871	\N	\N	\N	Razón social: Martha Headwear	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
311	Martha Headwear	33716911549	\N	\N	\N	Av. Cordoba nº 991 Piso 6 Dto A 1054	Razón social: Martha\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 181	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
312	Maycar SA	30612865333	\N	\N	\N	RN 3 KM 690 8000	Razón social: Vital\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 1\nCódigo Tango: 164	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
313	Mercantil Andina	30500036911	\N	\N	\N	Av Belgrano 672 1092	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 121	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
319	Milco SRL	30689618665	\N	\N	\N	Republica de libano 1728 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 137	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
320	Mix-57 S.A.S	30715851896	\N	\N	\N	Av. Bellgrano 211 1629	Localidad: Pilar\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 158	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
326	Moral Oscar Guillermo	20054797193	\N	\N	\N	Donado 79 8000	Razón social: Andreoli Impresos\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 146	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
327	Multiled S.A.	30691594668	\N	\N	\N	Salta nº 285 1074	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 75	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
328	Multiplacas SA	30708823151	\N	\N	\N	Zelarrayan 2143 8000	Localidad: Bahia blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 143	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
329	Naaloo - Capasitio S.A.S	30715919792	\N	\N	\N	Montevideo nº 589 Piso 9º Dpto B 1019	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 52	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
330	Newton Station SRL	30711980969	\N	\N	\N	Pueyrredon Honorio Dr Av1841	Razón social: Compra Gamer\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 136	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
332	Oil Suministros S.A	30716257025	\N	\N	\N	Av.Colon nº 671 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 50	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
333	Op de Estaciones de Svs SA	30678774495	\N	\N	\N	Vieytes 24 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 110	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
334	Origame Trade S.A.S	\N	\N	\N	\N	Humberto Primo nº 669	Localidad: Arroyo seco\nProvincia: Santa fe\nCódigo Tango: 12	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
335	Oviedo Yamila Daniela	27328388338	\N	\N	\N	San Martin 354 80000	Razón social: Casa Ramos\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 108	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
336	Petroeste de Eduardo Estivil	30707006575	\N	\N	\N	Av.Alem nº 1820 8000	Localidad: Bahia Blanca\nProvincia: Buemos Aires\nCondición: 0\nCódigo Tango: 49	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
337	Pintureria REX SA	30646512952	\N	\N	\N	Hipolito Yrigoyen 4369 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 131	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
338	Pintuteruas Miguel	33707092659	\N	\N	\N	California 2168 1289	Razón social: Miguel\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 90	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
339	Pisano SA	30521197702	\N	\N	\N	Av Pte Peron 9330 1714	Razón social: Pisano\nLocalidad: Ituzaingo\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 116	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
340	Promar SRL	30562496846	\N	\N	\N	Ohiggihns 644 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 113	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
341	Punto Grafico - Arana Mauricio	20247851497	\N	\N	\N	Sixto Laspiur nº 443 8000	Localidad: Bahia Blanca\nProvincia: Buenso Aires\nCondición: 0\nCódigo Tango: 51	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
342	RDB	23335087429	\N	\N	\N	Don Bosco 491 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 103	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
343	Redeye S.R.L	33717361399	\N	2110100	\N	Maipu nº 650	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 13	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
344	Resmacon	33652267179	\N	\N	\N	Av. Herrera nº 1425 1295	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 83	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
345	Rm Indumentaria S.R.L	30714303585	\N	\N	\N	Alsina nº 232 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 160	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
346	Rodriguez Monica	23204523134	\N	\N	\N	Tucuman 507 8332	Localidad: General Roca\nProvincia: Rio Negro\nCondición: 0\nCódigo Tango: 152	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
347	Rodriguez Rendon Juan Manuel	20352069761	\N	\N	\N	Sarmiento 2502 8000	Localidad: Bahia Blanca\nProvincia: Buenos aires\nCondición: 1\nCódigo Tango: 178	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
348	S.A Imp y Exp.de la Patagonia	30506730038	\N	\N	\N	Int.Perez Quintana nº 3850 1714	Razón social: La Anonima\nLocalidad: Ituzaingo\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 22	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
350	Salpa	33716250569	\N	\N	\N	Uspallata nº 2106 1282	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 59	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
351	Scandinavian Outdoors S.A	30640843329	\N	\N	\N	Av.Andres Rolon nº 1107 1642	Razón social: Columbia\nLocalidad: Isidro Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 63	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
352	Schiavoni Julieta	27288678842	\N	\N	\N	San Martin 82 8000	Razón social: H30\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 107	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
353	Sebmar SRL	30713980907	\N	\N	\N	Malvinas n° 3920 7600	Razón social: Carrocerias unimar\nLocalidad: del Plata Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 81	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
354	Serv. Pilmayquen SRL	30710650469	\N	\N	\N	Pïlmayquen 30 8000	Razón social: Estacion de servicios Pilmayqu\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 111	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
355	Softland	30646941136	\N	\N	\N	Av. Libertador nº 6343 1428	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 87	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
356	Soledad Di Sciullo	27263331066	\N	\N	\N	Alberdi nº 1949 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 27	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
357	Soxpig ue S.A	30664842919	\N	2914143526	info@mediarg.com	Ruta 33 Km 131 8170	Localidad: Buenos aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 5	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
358	Sports & Adventure S.A	30708046023	\N	2110100	\N	Migueletes 1646 nº Piso 1	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 18	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
359	Storm Control S.A	30708137479	\N	\N	\N	Acevedo nº 541 1414	Razón social: NatGeo\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 177	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
360	Tecnobahia	30708848219	\N	\N	\N	sixto laspiur 155 8000	Localidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 92	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
361	Telecom Argentina S.A.	30639453738	\N	\N	\N	Gral Hornos nº 690 1272	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 58	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
362	Telefonica Moviles Argentina S	30678814357	\N	\N	\N	Defensa nº 143 1065	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 61	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
363	Todo Plastic	30624066827	\N	\N	\N	Av Corrientes 2426 1425	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 100	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
364	Tomaschek Norma Susana	27038669171	\N	\N	\N	Jujuy nº 197 Piso 3 Dpto F 5000	Localidad: Cordoba\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 60	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
365	Top Gear S.R.L	33707714099	\N	1145044071	\N	Av.Nazca nº 2388	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 6	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
366	Trown S.R.L	30716859467	\N	1164820783	depositotrown@gmail.com	Basualdo nº 1175	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 11	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
367	Ullua Ruben Fernando	20184238269	\N	\N	\N	Av. Santa Fe nº 1670 1060	Localidad: Ciudad de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 171	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
368	Universidad Tecnologica Nac	30546671166	\N	\N	\N	11 de Abril nº 461 8000	Razón social: UTN\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 31	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
369	Vtex Informatica S.A	30713385707	\N	\N	\N	Patagones nº 2665 P 5 B 1437	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 72	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
371	Wald S.A	30519427008	\N	1168414142	hola@wald.com.ar	Av.Warnes nº 766	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos aires\nCondición: 0\nCódigo Tango: 16	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
372	Wengan S.A	30709557587	\N	3514442349	ventas@wengansa.com	Jujuy nº 2949	Localidad: Cordoba\nProvincia: Cordoba\nCondición: 0\nCódigo Tango: 8	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
373	West Company S.R.L	30636078790	\N	\N	\N	Santiago nº 418 2000	Localidad: Rosario\nProvincia: Santa Fe\nCondición: 0\nCódigo Tango: 25	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
374	Winners Prod. Depostivos S.A	30707725857	\N	1143607014	\N	Av.Montes de Oca nº 1555 1270	Razón social: Wilson-Salomon\nLocalidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 29	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
376	Zampatti Betina Mariela	27200451681	\N	\N	\N	San Martin nº 116 8000	Razón social: La Papeleria\nLocalidad: Bahia Blanca\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 74	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
377	Zoo Logic S.A	30707791973	\N	1177005700	\N	Av.del Libertador nº 6550 Piso 12 1428	Localidad: Ciudad Autonoma de Buenos Aires\nProvincia: Buenos Aires\nCondición: 0\nCódigo Tango: 26	t	3	2026-03-27 16:40:10.599448-03	2026-03-27 16:40:10.599448-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
370	WORLD SPORT	\N	Juan Perez 2920591019	\N	\N	\N	\N	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	World Sport
375	World Sport S.R.L.	30691209306	\N	\N	\N	Cornelio Saavedra nº 3150 7600	Localidad: del Plata Buenos\nProvincia: Aires Argentina\nCondición: 0\nCódigo Tango: 76	t	3	2026-03-27 16:40:10.599448-03	2026-04-21 10:40:01.395756-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	World Sport
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_orders (id, number, prefix, type, status, date, expected_date, notes, observations, total_ordered, total_received, provider_id, local_id, company_id, created_by_id, excel_file, pdf_file, created_at, updated_at, accepted_difference, accepted_difference_obs, selected_brands) FROM stdin;
116	MIDING S-001	MIDING S	REPOSICION	ANULADO	2026-04-22	\N	\N	\N	\N	\N	315	44	3	58	/pedidos-files/116_excel_b7a5080d.xlsx	\N	2026-04-22 14:15:17.581784-03	2026-04-22 14:15:35.435421-03	f	\N	Miding
119	MIDING S-004	MIDING S	REPOSICION	ANULADO	2026-04-22	\N	\N	\N	\N	\N	315	29	3	58	/pedidos-files/119_excel_5dc7f365.xlsx	\N	2026-04-22 14:43:11.242775-03	2026-04-24 14:12:16.032889-03	f	\N	Miding
118	MIDING S-003	MIDING S	REPOSICION	ANULADO	2026-04-22	\N	\N	\N	\N	\N	315	44	3	58	/pedidos-files/118_excel_7e195284.xlsx	\N	2026-04-22 14:28:16.572903-03	2026-04-24 14:12:18.328109-03	f	\N	\N
117	MIDING S-002	MIDING S	REPOSICION	ANULADO	2026-04-22	\N	\N	\N	\N	\N	314	22	3	58	/pedidos-files/117_excel_cc2f2d9d.xlsx	\N	2026-04-22 14:15:58.052505-03	2026-04-24 14:12:20.463496-03	f	\N	Miding
120	MIDING S-005	MIDING S	REPOSICION	COMPLETADO	2026-04-24	\N	\N	\N	\N	\N	315	22	3	58	/pedidos-files/120_excel_5c5bdf72.xlsx	\N	2026-04-24 14:13:17.278712-03	2026-04-24 14:13:21.491415-03	f	\N	Miding
\.


--
-- Data for Name: purchase_invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_invoices (id, number, type, status, date, due_date, amount, remito_venta_number, linked_to_id, pdf_file, pdf_parsed, observations, local_obs, compras_obs, is_partial, ingreso_status, ingreso_date, ingreso_photo, purchase_order_id, provider_id, local_id, company_id, created_by_id, created_at, updated_at, estado_semaforo, confirmado_local_at, confirmado_admin_at, confirmado_local_by_id, confirmado_admin_by_id) FROM stdin;
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase_order_items (id, purchase_order_id, variant_id, code, description, quantity_ordered, quantity_received, unit_cost, created_at, updated_at) FROM stdin;
\.


--
-- Name: locals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.locals_id_seq', 45, true);


--
-- Name: providers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.providers_id_seq', 380, true);


--
-- Name: purchase_invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_invoices_id_seq', 348, true);


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_order_items_id_seq', 1, false);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_orders_id_seq', 120, true);


--
-- PostgreSQL database dump complete
--

\unrestrict UO2SGNJl0wUlLb8HSHVdkJy5m5qP1E5XXV6kX7Nx9dqroN5KFA65dvVx2GEAwdk

