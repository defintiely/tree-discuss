/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес проекта Supabase; пусто — приложение работает только локально. */
  readonly VITE_SUPABASE_URL?: string;
  /** Публичный anon-ключ: он и рассчитан лежать в коде страницы. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
