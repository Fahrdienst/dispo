# Source Directory Context

This `GEMINI.md` provides specific guidelines for the `src` directory, focusing on Next.js App Router architecture, component design, and state management.

## 1. Architecture: Next.js App Router

- **Server-First:** Assume all components are Server Components unless `use client` is explicitly required.
- **Data Fetching:**
  - **Server Components:** Fetch data directly from the database/API using `await`.
  - **Client Components:** Pass data down as props or use Server Actions. Avoid `useEffect` for data fetching where possible.
- **Mutations:** Use **Server Actions** (`src/actions`) for all data writes (POST, PUT, DELETE).
  - Use `zod` schemas to validate inputs in actions.
  - Return standardized response objects (e.g., `{ success: boolean, error?: string, data?: any }`).

## 2. Directory Organization

- **`app/`**: Routes. Keep logic minimal here. Delegate to feature components.
  - `(group)`: Use route groups for layout isolation (e.g., `(dashboard)`, `(auth)`).
- **`components/`**:
  - `ui/`: Shared, dumb UI components (Shadcn/Radix). Do not add business logic here.
  - `<feature>/`: Feature-specific components (e.g., `drivers/DriverList.tsx`, `rides/RideCard.tsx`).
- **`lib/`**:
  - `utils.ts`: General helpers (formatting, class merging).
  - `supabase/`: Supabase client instantiation.
  - `types/`: Shared TypeScript interfaces.

## 3. State Management

- **URL State:** Prefer URL search params for bookmarkable state (filters, pagination, tabs).
- **Server State:** React Server Components (RSC) handle initial state.
- **Client State:** `useState` / `useReducer` for ephemeral UI state (modals, form inputs).
- **Global State:** Avoid unless absolutely necessary.

## 4. Styling (Tailwind CSS)

- **Utility-First:** Use utility classes directly in `className`.
- **`cn()` Utility:** Always use `cn()` (clsx + tailwind-merge) for conditional classes and merging props.
  ```tsx
  <div className={cn("p-4 bg-white", className)}>...</div>
  ```
- **Responsive:** Use `sm:`, `md:`, `lg:` prefixes. Mobile-first.

## 5. Error Handling & Feedback

- **Toast Notifications:** Use `useToast` hook for user feedback (success/error messages).
- **Error Boundaries:** Use `error.tsx` files in route segments for graceful failure handling.
