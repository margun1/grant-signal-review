CREATE TABLE public.secretary_briefings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 briefing_date date NOT NULL, status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','ready','failed')),
 content text, sources jsonb NOT NULL DEFAULT '{}'::jsonb, error text, request_key uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,briefing_date)
);
GRANT SELECT ON public.secretary_briefings TO authenticated;
GRANT ALL ON public.secretary_briefings TO service_role;
ALTER TABLE public.secretary_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own staff briefings" ON public.secretary_briefings FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE TABLE public.secretary_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 client_id text NOT NULL, role text NOT NULL CHECK(role IN ('user','assistant')), parts jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,client_id)
);
GRANT SELECT,INSERT ON public.secretary_messages TO authenticated;
GRANT ALL ON public.secretary_messages TO service_role;
ALTER TABLE public.secretary_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own staff messages read" ON public.secretary_messages FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "own staff messages insert" ON public.secretary_messages FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.claim_secretary_briefing(_force boolean, _request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date := (now() AT TIME ZONE 'Asia/Seoul')::date; r public.secretary_briefings; claimed boolean:=false;
BEGIN
 IF NOT public.is_staff(auth.uid()) OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 INSERT INTO public.secretary_briefings(user_id,briefing_date,request_key) VALUES(auth.uid(),d,_request_key) ON CONFLICT(user_id,briefing_date) DO NOTHING RETURNING * INTO r;
 IF FOUND THEN claimed:=true;
 ELSE
 SELECT * INTO r FROM public.secretary_briefings WHERE user_id=auth.uid() AND briefing_date=d FOR UPDATE;
 IF _force AND r.request_key<>_request_key AND r.status<>'generating' THEN
 UPDATE public.secretary_briefings SET status='generating',error=null,request_key=_request_key,revision=revision+1,updated_at=now() WHERE id=r.id RETURNING * INTO r; claimed:=true;
 END IF;
 END IF;
 RETURN jsonb_build_object('claimed',claimed,'row',to_jsonb(r));
END $$;
REVOKE ALL ON FUNCTION public.claim_secretary_briefing(boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_secretary_briefing(boolean,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.secretary_summary(_today date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE w date:=date_trunc('week',_today)::date; m date:=date_trunc('month',_today)::date; pm date:=(date_trunc('month',_today)-interval '1 month')::date; result jsonb;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 WITH periods AS (
 SELECT 'yesterday' AS label,_today-1 AS s,_today-1 AS e UNION ALL
 SELECT 'thisWeek',w,_today UNION ALL SELECT 'lastWeek',w-7,w-1 UNION ALL
 SELECT 'lastWeekComparable',w-7,_today-7 UNION ALL SELECT 'thisMonth',m,_today UNION ALL SELECT 'lastMonth',pm,m-1
 ), sales_summary AS (
 SELECT p.label,p.s,p.e,count(s.id) AS rows,sum(s.amount) AS revenue,sum(s.quantity) AS quantity,
 EXISTS(SELECT 1 FROM public.data_uploads u WHERE u.kind='sales' AND u.period_start<=p.s AND u.period_end>=p.e) AS covered
 FROM periods p LEFT JOIN public.sales s ON s.sale_date BETWEEN p.s AND p.e GROUP BY p.label,p.s,p.e
 ), latest AS (SELECT DISTINCT ON(item) item,quantity,as_of FROM public.inventory_snapshots ORDER BY item,as_of DESC,created_at DESC), shortage AS (
 SELECT i.name,l.quantity,i.min_stock,l.as_of,greatest(0,i.target_stock-l.quantity-coalesce((SELECT sum(o.quantity) FROM public.purchase_orders o WHERE o.item=i.name AND o.status='발주 완료'),0)) AS recommended
 FROM public.inventory_items i JOIN latest l ON l.item=i.name WHERE l.quantity<i.min_stock
 )
 SELECT jsonb_build_object(
 'sales',(SELECT jsonb_object_agg(label,jsonb_build_object('start',s,'end',e,'records',rows,'revenue',CASE WHEN rows>0 THEN revenue WHEN covered THEN 0 ELSE NULL END,'quantity',CASE WHEN rows>0 THEN quantity WHEN covered THEN 0 ELSE NULL END,'covered',covered)) FROM sales_summary),
 'shortageCount',(SELECT count(*) FROM shortage),'shortages',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT * FROM shortage ORDER BY name LIMIT 8) q),'[]'::jsonb),
 'pendingOrders',(SELECT count(*) FROM public.purchase_orders WHERE status='발주 완료'),
 'todayTasks',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT title,due_date FROM public.tasks WHERE due_date=_today AND done=false ORDER BY title LIMIT 8) q),'[]'::jsonb),
 'todayTaskCount',(SELECT count(*) FROM public.tasks WHERE due_date=_today AND done=false),
 'weekMeetings',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT kind,title,start_at,status FROM public.meetings WHERE status<>'취소' AND start_at>=(w::text||'T00:00:00+09:00')::timestamptz AND start_at<((w+7)::text||'T00:00:00+09:00')::timestamptz ORDER BY start_at LIMIT 10) q),'[]'::jsonb),
 'weekMeetingCount',(SELECT count(*) FROM public.meetings WHERE status<>'취소' AND start_at>=(w::text||'T00:00:00+09:00')::timestamptz AND start_at<((w+7)::text||'T00:00:00+09:00')::timestamptz),
 'rainDaySales',null
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.secretary_summary(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.secretary_summary(date) TO authenticated;