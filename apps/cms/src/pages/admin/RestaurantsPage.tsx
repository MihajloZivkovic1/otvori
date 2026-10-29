import { useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  MODULES,
  PLANS,
  RESTAURANT_SORT_KEYS,
  RESTAURANT_STATUSES,
  type ModuleKey,
  type Plan,
  type RestaurantSortKey,
  type RestaurantStatus,
  type SuperadminRestaurantDto,
} from "@qr-menu/shared";
import {
  ModuleIcons,
  StatusChip,
  capitalize,
  planLabel,
  when,
} from "../../components/admin/bits";
import { Icon } from "../../components/icons";
import { LogoTile } from "../../components/LogoTile";
import { MobileHeader, PageHeader } from "../../components/shell/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge, StatusDot } from "../../components/ui/Chip";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input, Select } from "../../components/ui/Field";
import { useDebounced } from "../../hooks/useDebounced";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { useAdminRestaurants } from "../../lib/admin";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { STATUS_TONE } from "../../components/admin/bits";

const PAGE_SIZE = 50;
const MODULE_LABELS: Record<ModuleKey, string> = {
  ordering: "Ordering",
  payments: "Online payment",
  pos: "POS",
};

/** /admin/restaurants — every venue, with filters in the URL so the browser's back button and reloads keep them. */
export function RestaurantsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const status = (params.get("status") ?? "") as RestaurantStatus | "";
  const plan = (params.get("plan") ?? "") as Plan | "";
  const module = (params.get("module") ?? "") as ModuleKey | "";
  const onboarding = params.get("setup") === "1";
  const sort = (
    (RESTAURANT_SORT_KEYS as readonly string[]).includes(
      params.get("sort") ?? "",
    )
      ? params.get("sort")
      : "updatedAt"
  ) as RestaurantSortKey;
  const dir: "asc" | "desc" = params.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const search = useDebounced(q.trim(), 300);

  const set = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.delete("page");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const query = useMemo(
    () => ({
      search: search || undefined,
      status: status || undefined,
      plan: plan || undefined,
      module: module || undefined,
      onboarding: onboarding ? true : undefined,
      sort,
      dir,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, status, plan, module, onboarding, sort, dir, page],
  );
  const list = useAdminRestaurants(query);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const filtered = Boolean(search || status || plan || module || onboarding);

  const onSort = (key: string) => {
    if (key === sort) set({ dir: dir === "asc" ? "desc" : "asc" });
    else
      set({
        sort: key,
        dir: key === "name" || key === "owner" ? "asc" : "desc",
      });
  };

  const columns: Column<SuperadminRestaurantDto>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoTile
            name={row.name}
            color={row.primaryColor}
            logoUrl={row.logoUrl}
            size={28}
            radius={7}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-ink">
                {row.name}
              </span>
              {row.onboardingStep ? (
                <Badge className="bg-accent-soft text-accent">
                  SETUP {row.onboardingStep}/4
                </Badge>
              ) : null}
            </div>
            <div className="truncate text-xs text-muted">
              {row.slug}
              {row.city ? ` · ${row.city}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: "110px",
      cell: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "plan",
      header: "Plan",
      sortable: true,
      width: "150px",
      cell: (row) => <span className="text-ink-2">{planLabel(row)}</span>,
    },
    {
      key: "modules",
      header: "Modules",
      width: "96px",
      cell: (row) => <ModuleIcons modules={row.modules} />,
    },
    {
      key: "tables",
      header: "Tables · items",
      sortable: true,
      align: "right",
      width: "120px",
      cell: (row) => (
        <span className="text-ink-2">
          {row.tableCount} · {row.itemCount}
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      sortable: true,
      width: "200px",
      className: "max-wide:hidden",
      cell: (row) =>
        row.owner ? (
          <div className="min-w-0">
            <div className="truncate text-ink">{row.owner.name}</div>
            <div className="truncate text-xs text-muted">{row.owner.email}</div>
          </div>
        ) : (
          <span className="text-muted">No owner yet</span>
        ),
    },
    {
      key: "updatedAt",
      header: "Last edited",
      sortable: true,
      align: "right",
      width: "120px",
      cell: (row) => <span className="text-muted">{when(row.updatedAt)}</span>,
    },
    {
      key: "lastScanAt",
      header: "Last scan",
      sortable: true,
      align: "right",
      width: "120px",
      cell: (row) => <span className="text-muted">{when(row.lastScanAt)}</span>,
    },
  ];

  const filters = (
    <div className={cn("flex flex-wrap gap-2", isMobile && "px-4")}>
      <div className={isMobile ? "w-full" : "w-[280px]"}>
        <Input
          type="search"
          aria-label="Search restaurants"
          placeholder="Name, slug, city or owner e-mail"
          value={q}
          onChange={(event) => set({ q: event.target.value })}
          controlSize={isMobile ? "lg" : "md"}
          className={isMobile ? "" : "h-9 text-[13px]"}
        />
      </div>
      <div className={isMobile ? "flex-1" : "w-[130px]"}>
        <Select
          aria-label="Status"
          value={status}
          onChange={(event) => set({ status: event.target.value })}
          className={isMobile ? "" : "h-9 text-[13px]"}
        >
          <option value="">Any status</option>
          {RESTAURANT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {capitalize(value)}
            </option>
          ))}
        </Select>
      </div>
      <div className={isMobile ? "flex-1" : "w-[120px]"}>
        <Select
          aria-label="Plan"
          value={plan}
          onChange={(event) => set({ plan: event.target.value })}
          className={isMobile ? "" : "h-9 text-[13px]"}
        >
          <option value="">Any plan</option>
          {PLANS.map((value) => (
            <option key={value} value={value}>
              {capitalize(value)}
            </option>
          ))}
        </Select>
      </div>
      <div className={isMobile ? "flex-1" : "w-[150px]"}>
        <Select
          aria-label="Module"
          value={module}
          onChange={(event) => set({ module: event.target.value })}
          className={isMobile ? "" : "h-9 text-[13px]"}
        >
          <option value="">Any module</option>
          {MODULES.map((value) => (
            <option key={value} value={value}>
              {MODULE_LABELS[value]} on
            </option>
          ))}
        </Select>
      </div>
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2",
          isMobile ? "h-12" : "h-9",
        )}
      >
        <input
          type="checkbox"
          checked={onboarding}
          onChange={(event) =>
            set({ setup: event.target.checked ? "1" : null })
          }
          className="size-4 accent-[var(--accent)]"
        />
        Setup incomplete
      </label>
      {filtered ? (
        <Button
          size={isMobile ? "lg" : "sm"}
          variant="ghost"
          onClick={() => setParams(new URLSearchParams(), { replace: true })}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );

  const newVenue = (
    <Button
      variant="primary"
      icon={<Icon name="plus" size={14} strokeWidth={2.2} />}
      onClick={() => navigate("/admin/restaurants/new")}
      size={isMobile ? "lg" : "md"}
    >
      New venue
    </Button>
  );

  return (
    <div
      className={cn(
        "flex flex-1 flex-col",
        isMobile ? "gap-3 pb-6" : "gap-4 p-6",
      )}
    >
      {isMobile ? (
        <MobileHeader
          large
          title="Restaurants"
          action={
            <Link
              to="/admin/restaurants/new"
              aria-label="New venue"
              className="grid size-11 place-items-center rounded-lg text-accent"
            >
              <Icon name="plus" size={22} strokeWidth={2} />
            </Link>
          }
        />
      ) : (
        <PageHeader
          title="Restaurants"
          subtitle={
            list.data
              ? `${total} ${total === 1 ? "venue" : "venues"}${filtered ? " match" : " on this instance"}.`
              : "Every venue on this instance."
          }
          actions={newVenue}
        />
      )}
      {filters}
      <DataTable
        ariaLabel="Restaurants"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ key: sort, dir }}
        onSort={onSort}
        onRowClick={(row) => navigate(`/admin/restaurants/${row.id}`)}
        rowLabel={(row) => `Open ${row.name}`}
        loading={list.isPending}
        error={list.isError ? list.error : undefined}
        errorMessage={(error) =>
          errorMessage(error, "Could not load restaurants")
        }
        onRetry={() => void list.refetch()}
        dimmed={list.isPlaceholderData}
        empty={
          filtered ? (
            <EmptyState
              variant="inline"
              title="No venues match these filters."
              actions={
                <Button
                  size="sm"
                  onClick={() =>
                    setParams(new URLSearchParams(), { replace: true })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              title="No venues yet."
              description="Create the first one with the wizard."
              actions={newVenue}
            />
          )
        }
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPage: (next) => set({ page: String(next) }, false),
        }}
        mobile={isMobile}
        mobileRow={(row) => (
          <>
            <LogoTile
              name={row.name}
              color={row.primaryColor}
              logoUrl={row.logoUrl}
              size={36}
              radius={9}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[15px] font-medium">
                  {row.name}
                </span>
                {row.onboardingStep ? (
                  <Badge className="bg-accent-soft text-accent">SETUP</Badge>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <StatusDot tone={STATUS_TONE[row.status]} />{" "}
                {capitalize(row.status)} · {planLabel(row)}
                {row.city ? ` · ${row.city}` : ""}
              </span>
            </span>
            <Icon
              name="chevronRight"
              size={16}
              strokeWidth={1.8}
              className="shrink-0 text-muted"
            />
          </>
        )}
      />
    </div>
  );
}
