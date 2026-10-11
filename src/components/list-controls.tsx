import { Search, type LucideIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const PAGE_SIZE = 25;

type ListParams = { q?: string; page?: string; archived?: string };

/** Parses list search params into a search term, 1-based page and archived flag. */
export function parseListParams(params: ListParams) {
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  return { q: (params.q ?? "").trim(), page, archived: params.archived === "1" };
}

function href(path: string, params: { q: string; page: number; archived: boolean; params?: Record<string, string> }) {
  // Extra filters (e.g. audit log module/user) ride along so paging keeps them.
  const search = new URLSearchParams(Object.entries(params.params ?? {}).filter(([, v]) => v));
  if (params.q) search.set("q", params.q);
  if (params.page > 1) search.set("page", String(params.page));
  if (params.archived) search.set("archived", "1");
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Full-width table row shown when a list has no rows. */
export function EmptyRow({ colSpan, icon: Icon, title, description }: { colSpan: number; icon: LucideIcon; title: string; description: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="whitespace-normal">
        <Empty className="min-h-[50vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </TableCell>
    </TableRow>
  );
}

/** GET search form; submitting resets to page 1. */
export function SearchForm({ q, archived, placeholder }: { q: string; archived: boolean; placeholder: string }) {
  return (
    <form className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input name="q" defaultValue={q} placeholder={placeholder} className="pl-8" aria-label={placeholder} />
      {archived && <input type="hidden" name="archived" value="1" />}
    </form>
  );
}

/** Link toggling between active and archived records. */
export function ArchivedToggle({ path, q, archived }: { path: string; q: string; archived: boolean }) {
  return (
    <a href={href(path, { q, page: 1, archived: !archived })} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
      {archived ? "Show active" : "Show archived"}
    </a>
  );
}

export function ListPagination(props: { path: string; q: string; archived: boolean; page: number; total: number; params?: Record<string, string> }) {
  const { path, page, total } = props;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={href(path, { ...props, page: page - 1 })}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
        <PaginationItem className="px-2 text-sm text-muted-foreground">
          Page {page} of {pages}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href={href(path, { ...props, page: page + 1 })}
            aria-disabled={page >= pages}
            className={page >= pages ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
