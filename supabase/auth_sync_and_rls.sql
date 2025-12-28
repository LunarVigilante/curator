-- ============================================================================
-- SUPABASE AUTH SYNC & ROW LEVEL SECURITY SETUP
-- Run this in the Supabase SQL Editor after running Prisma migrations
-- ============================================================================

-- ============================================================================
-- TASK 2: AUTH SYNC TRIGGER
-- Automatically creates a profile in public.profiles when a user signs up
-- ============================================================================

-- Create the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create the trigger that fires on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optional: Handle email updates from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email, updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- Optional: Clean up profile when user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- ============================================================================
-- TASK 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables that need protection
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROFILES TABLE POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Public profiles are visible to everyone
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (is_public = true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only super-admins can insert (handled by trigger) or delete
-- Regular users cannot insert/delete profiles directly
CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- CATEGORIES TABLE POLICIES
-- -----------------------------------------------------------------------------

-- Public categories are viewable by everyone
CREATE POLICY "Public categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (is_public = true);

-- Users can view their own categories
CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  USING (auth.uid() = user_id);

-- Featured/Template categories are viewable by everyone
CREATE POLICY "Featured categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (is_featured = true OR is_template = true);

-- Users can create their own categories
CREATE POLICY "Users can create own categories"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own categories
CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own categories
CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- ITEMS TABLE POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own items
CREATE POLICY "Users can view own items"
  ON public.items FOR SELECT
  USING (auth.uid() = user_id);

-- Items in public categories are viewable
CREATE POLICY "Items in public categories are viewable"
  ON public.items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.categories
      WHERE categories.id = items.category_id
      AND categories.is_public = true
    )
  );

-- Users can create their own items
CREATE POLICY "Users can create own items"
  ON public.items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own items
CREATE POLICY "Users can update own items"
  ON public.items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Users can delete own items"
  ON public.items FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RATINGS TABLE POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own ratings
CREATE POLICY "Users can view own ratings"
  ON public.ratings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can CRUD their own ratings
CREATE POLICY "Users can manage own ratings"
  ON public.ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- ACTIVITIES TABLE POLICIES
-- -----------------------------------------------------------------------------

-- Users can view their own activities
CREATE POLICY "Users can view own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = user_id);

-- Activities of public profiles are visible in feeds
CREATE POLICY "Public user activities are viewable"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = activities.user_id
      AND profiles.is_public = true
    )
  );

-- Users can create their own activities
CREATE POLICY "Users can create own activities"
  ON public.activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- GLOBAL ITEMS (No RLS - Public Reference Data)
-- -----------------------------------------------------------------------------
-- global_items is public reference data, no RLS needed
-- ALTER TABLE public.global_items ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- SYSTEM SETTINGS (Admin Only)
-- -----------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Service role can always access (for server-side operations)
CREATE POLICY "Service role can access system settings"
  ON public.system_settings FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- USEFUL HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'ADMIN'
  );
$$;

-- Get current user's profile
CREATE OR REPLACE FUNCTION public.get_current_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
