import Link from 'next/link';

import type { Department } from '@/lib/api/categories';

// Linha de departamentos do cabeçalho (AC-025). Sem departamentos, não aparece nada.
// As páginas /c/{slug} chegam na feature `vitrine`.
export function CategoryMenu({ departments }: { departments: Department[] }) {
  if (departments.length === 0) return null;

  return (
    <nav aria-label="Departamentos" className="border-t border-border">
      <ul className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-2 text-sm">
        {departments.map((department) => (
          <li key={department.href}>
            <Link
              href={department.href}
              className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {department.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
