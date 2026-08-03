import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreateCheckout,
  useOpenBillingPortal,
} from "@/hooks/mutations/billing/use-billing-actions";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDate as formatLocalizedDate } from "@/lib/format";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
});

type Interval = "monthly" | "annual";
type PlanKey = "personal" | "team";

/** Prices stay literal; every label is resolved from `settings:billing.plans.*`. */
const PLANS: {
  plan: PlanKey;
  monthly: { price: string };
  annual: { price: string };
  featureKeys: string[];
  highlighted?: boolean;
}[] = [
  {
    plan: "personal",
    monthly: { price: "$4" },
    annual: { price: "$40" },
    featureKeys: ["singleUser", "unlimitedProjects", "backups", "emailSupport"],
  },
  {
    plan: "team",
    monthly: { price: "$5" },
    annual: { price: "$50" },
    featureKeys: [
      "unlimitedMembers",
      "unlimitedProjects",
      "rolesPermissions",
      "backups",
      "prioritySupport",
    ],
    highlighted: true,
  },
];

const STATUS_VARIANTS: Record<
  string,
  "success" | "warning" | "error" | "secondary"
> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  scheduled_cancel: "warning",
  canceled: "error",
  expired: "error",
  paused: "secondary",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return formatLocalizedDate(value, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="font-medium text-md">{title}</h2>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canManage = isAdmin;

  const { data: billing, isLoading } = useGetBilling(workspaceId);
  const checkout = useCreateCheckout(workspaceId);
  const portal = useOpenBillingPortal(workspaceId);
  const [interval, setInterval] = useState<Interval>("annual");

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!billing?.billingEnabled) {
    return (
      <>
        <PageTitle title={t("settings:billing.title")} />
        <div className="mx-auto max-w-4xl space-y-2">
          <h1 className="font-semibold text-2xl">
            {t("settings:billing.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("settings:billing.notEnabled")}
          </p>
        </div>
      </>
    );
  }

  const hasSubscription = Boolean(billing.plan && billing.status);
  const statusVariant = billing.status
    ? STATUS_VARIANTS[billing.status]
    : undefined;
  const renews = formatDate(billing.currentPeriodEnd);
  const trialDaysLeft = daysUntil(billing.trialEndsAt);
  const trialExpired =
    !billing.foundingFree && !hasSubscription && trialDaysLeft === 0;

  const pricePer = t(
    billing.billingInterval === "annual"
      ? "settings:billing.interval.year"
      : "settings:billing.interval.month",
  );
  const planLabel =
    billing.plan === "team" || billing.plan === "personal"
      ? t(`settings:billing.plans.${billing.plan}.name`)
      : null;

  return (
    <>
      <PageTitle title={t("settings:billing.title")} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">
            {t("settings:billing.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:billing.subtitle")}
          </p>
        </div>

        {/* ── Current plan ── */}
        <div className="space-y-6">
          <SectionHeader
            title={t("settings:billing.currentPlan.title")}
            subtitle={t("settings:billing.currentPlan.subtitle")}
          />

          {billing.foundingFree ? (
            <div className="overflow-hidden rounded-md border border-primary/30 bg-sidebar">
              <div className="flex items-start gap-3 p-5">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">
                      {t("settings:billing.foundingFree.title")}
                    </h3>
                    <Badge variant="success" size="sm">
                      {t("settings:billing.foundingFree.badge")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t("settings:billing.foundingFree.description")}
                  </p>
                </div>
              </div>
            </div>
          ) : hasSubscription ? (
            <div className="rounded-md border border-border bg-sidebar">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">
                      {t("settings:billing.subscription.planName", {
                        plan: planLabel ?? "",
                      })}
                    </h3>
                    {statusVariant && billing.status ? (
                      <Badge variant={statusVariant} size="sm">
                        {t(`settings:billing.status.${billing.status}`)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {billing.plan === "team"
                      ? t("settings:billing.subscription.pricePerUser", {
                          price: billing.billingInterval === "annual" ? 50 : 5,
                          interval: pricePer,
                        })
                      : t("settings:billing.subscription.price", {
                          price: billing.billingInterval === "annual" ? 40 : 4,
                          interval: pricePer,
                        })}
                    {billing.seats > 1
                      ? ` · ${t("settings:billing.subscription.seats", {
                          count: billing.seats,
                        })}`
                      : null}
                  </p>
                </div>
                <div className="text-right">
                  {renews ? (
                    <p className="text-muted-foreground text-xs">
                      {billing.canceledAt
                        ? t("settings:billing.subscription.accessEnds")
                        : t("settings:billing.subscription.renews")}
                    </p>
                  ) : null}
                  {renews ? (
                    <p className="font-medium text-sm">{renews}</p>
                  ) : null}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="text-muted-foreground text-xs">
                  {t("settings:billing.subscription.manageHint")}
                </p>
                {billing.hasCustomer ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManage || portal.isPending}
                    onClick={() => portal.mutate()}
                  >
                    {portal.isPending
                      ? t("settings:billing.subscription.opening")
                      : t("settings:billing.subscription.manage")}
                    <ArrowUpRight className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-md border bg-sidebar p-5",
                trialExpired ? "border-warning/40" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex size-9 items-center justify-center rounded-md",
                    trialExpired
                      ? "bg-warning/10 text-warning-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {trialExpired ? (
                    <TriangleAlert className="size-4.5" />
                  ) : (
                    <Sparkles className="size-4.5" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">
                    {trialExpired
                      ? t("settings:billing.trial.endedTitle")
                      : t("settings:billing.trial.title")}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {trialExpired
                      ? t("settings:billing.trial.endedDescription")
                      : trialDaysLeft !== null
                        ? t("settings:billing.trial.daysLeft", {
                            count: trialDaysLeft,
                          })
                        : t("settings:billing.trial.chooseAfterTrial")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Plan picker ── */}
        {!billing.foundingFree && !hasSubscription ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeader
                title={t("settings:billing.planPicker.title")}
                subtitle={t("settings:billing.planPicker.subtitle")}
              />
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-sidebar p-0.5 text-xs">
                  {(["monthly", "annual"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterval(value)}
                      className={cn(
                        "rounded-[0.3rem] px-3 py-1 font-medium transition-colors",
                        interval === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`settings:billing.interval.${value}`)}
                    </button>
                  ))}
                </div>
                {interval === "annual" ? (
                  <Badge variant="success" size="sm">
                    {t("settings:billing.planPicker.twoMonthsFree")}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLANS.map((p) => {
                  const price = interval === "monthly" ? p.monthly : p.annual;
                  const planName = t(`settings:billing.plans.${p.plan}.name`);
                  const suffix = t(
                    `settings:billing.plans.${p.plan}.${interval}Suffix`,
                  );
                  const note = t(
                    `settings:billing.plans.${p.plan}.${interval}Note`,
                  );
                  return (
                    <div
                      key={p.plan}
                      className={cn(
                        "flex flex-col rounded-xl border p-6",
                        p.highlighted
                          ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
                          : "border-border/70 bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{planName}</h3>
                        {p.highlighted ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                            {t("settings:billing.planPicker.mostPopular")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-foreground/60 text-sm">
                        {t(`settings:billing.plans.${p.plan}.tagline`)}
                      </p>

                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="font-medium text-4xl tracking-tight">
                          {price.price}
                        </span>
                        <span className="text-foreground/60 text-sm">
                          {suffix}
                        </span>
                      </div>
                      <p className="mt-1.5 text-foreground/60 text-sm">
                        {note}
                      </p>

                      <ul className="mt-8 flex-1 space-y-3 text-sm">
                        {p.featureKeys.map((featureKey) => (
                          <li
                            key={featureKey}
                            className="flex items-start gap-2.5"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="text-foreground/90">
                              {t(
                                `settings:billing.plans.${p.plan}.features.${featureKey}`,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant={p.highlighted ? "default" : "outline"}
                        className="mt-8 w-full"
                        disabled={!canManage || checkout.isPending}
                        onClick={() =>
                          checkout.mutate({ plan: p.plan, interval })
                        }
                      >
                        {checkout.isPending
                          ? t("settings:billing.planPicker.starting")
                          : t("settings:billing.planPicker.choose", {
                              plan: planName,
                            })}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {canManage
                ? t("settings:billing.planPicker.paymentNote")
                : t("settings:billing.planPicker.noPermission")}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
