-- M4 Step 4: Add RLS policies for driver self-service availability
-- + DELETE policies for replace-all strategy

-- =============================================================
-- 4a: Driver can INSERT own availability slots
-- =============================================================

CREATE POLICY availability_insert_driver ON public.driver_availability
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );

-- =============================================================
-- 4b: DELETE policies (replace-all strategy)
-- =============================================================

-- Staff can delete any availability
CREATE POLICY availability_delete_staff ON public.driver_availability
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'operator')
  );

-- Driver can delete own availability
CREATE POLICY availability_delete_driver ON public.driver_availability
  FOR DELETE USING (
    public.get_user_role() = 'driver'
    AND driver_id = public.get_user_driver_id()
  );
