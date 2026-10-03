import { useMemo, useState, useEffect, type AnchorHTMLAttributes, type FormHTMLAttributes, type ReactNode } from "react";
import { Link as RouterLink, useRouter, useRouterState } from "@tanstack/react-router";
import { usePageState } from "./page";
import type { ResultData } from "./http";
export type { AppLoadContext, LoaderFunctionArgs, ActionFunctionArgs } from "./http";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string; viewTransition?: boolean; replace?: boolean; preventScrollReset?: boolean; reloadDocument?: boolean; prefetch?: "intent" | "render" | "viewport" | "none";
};
export function Link({ to, viewTransition, preventScrollReset, reloadDocument, prefetch, ...props }: LinkProps) {
  if (/^(?:https?:|mailto:|tel:)/i.test(to) || reloadDocument) return <a href={to} {...props} />;
  return <RouterLink to={to} viewTransition={viewTransition} resetScroll={!preventScrollReset} preload={prefetch === "none" ? false : "intent"} {...props} />;
}
export function NavLink({ className, ...props }: Omit<LinkProps, "className"> & { className?: string | ((state: { isActive: boolean }) => string) }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isActive = props.to === "/" ? pathname === "/" : pathname === props.to || pathname.startsWith(props.to + "/");
  return <Link {...props} aria-current={isActive ? "page" : undefined} className={typeof className === "function" ? className({ isActive }) : className} />;
}
export function useLoaderData<T>() {
  return useRouterState({ select: s => s.matches[s.matches.length - 1]?.loaderData }) as ResultData<T>;
}
export function useRouteLoaderData<T = unknown>(_id: string) {
  return useRouterState({ select: s => s.matches[0]?.loaderData }) as ResultData<T> | undefined;
}
export function useActionData<T>() { return usePageState()?.actionData as ResultData<T> | undefined; }
export function useNavigation() {
  const pending = usePageState()?.pending;
  const loading = useRouterState({ select: s => s.status === "pending" });
  return { state: pending ? "submitting" : loading ? "loading" : "idle" };
}
export function useLocation() {
  return useRouterState({ select: s => ({ pathname: s.location.pathname, search: s.location.searchStr, hash: s.location.hash ? "#" + s.location.hash : "", key: s.location.state.__TSR_key ?? "initial" }) });
}
export function useNavigate() {
  const router = useRouter();
  return (to: string | number, options: { replace?: boolean } = {}) => typeof to === "number"
    ? router.history.go(to) : router.navigate({ href: to, ...options });
}
export function useNavigationType() {
  const router = useRouter(); const [action, setAction] = useState<"PUSH" | "REPLACE" | "POP">("POP");
  useEffect(() => router.history.subscribe(({ action }: { action: { type: string } }) => setAction(action.type === "PUSH" || action.type === "REPLACE" ? action.type : "POP")), [router]);
  return action;
}
type FormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "method" | "action"> & {
  action?: string;
  method?: "get" | "post"; preventScrollReset?: boolean; replace?: boolean;
  onResult?: (result: unknown) => void; onPending?: (pending: boolean) => void;
};
export function Form({ method = "get", action, onSubmit, preventScrollReset, replace, onResult, onPending, ...props }: FormProps) {
  const router = useRouter(); const page = usePageState();
  return <form {...props} method={method} action={action} onSubmit={async event => {
    onSubmit?.(event); if (event.defaultPrevented) return;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
    const target = submitter?.formAction && submitter.hasAttribute("formaction") ? submitter.formAction : action || form.action;
    const effectiveMethod = submitter?.getAttribute("formmethod") || method;
    const url = new URL(target, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    const body = new FormData(form, submitter);
    if (effectiveMethod.toLowerCase() === "get") {
      url.search = new URLSearchParams(body as never).toString();
      await router.navigate({ href: url.pathname + url.search, replace, resetScroll: !preventScrollReset }); return;
    }
    page?.setPending(true); onPending?.(true);
    try {
      // Existing handlers expect urlencoded forms, including their explicit body limits.
      const response = await fetch(url, { method: "POST", headers: { "X-Website-Action": "1", "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body as never), redirect: "manual" });
      const result: unknown = response.headers.get("Content-Type")?.includes("application/json")
        ? await response.json() : { error: await response.text() || `HTTP ${response.status}` };
      if (result && typeof result === "object" && "redirect" in result && typeof result.redirect === "string") {
        window.location.assign(result.redirect); return;
      }
      (onResult ?? page?.setActionData)?.(result);
      if (response.ok) await router.invalidate();
    } catch {
      (onResult ?? page?.setActionData)?.({ error: "送信できませんでした。通信状態を確認して、もう一度試してください。" });
    } finally { page?.setPending(false); onPending?.(false); }
  }} />;
}
export function useFetcher<T>() {
  const [result, setResult] = useState<T>(); const [pending, setPending] = useState(false);
  const FetcherForm = useMemo(() => function FetcherForm(props: FormProps) {
    return <Form {...props} onResult={value => setResult(value as T)} onPending={setPending} />;
  }, []);
  return { Form: FetcherForm, data: result, state: pending ? "submitting" : "idle" };
}
export function useSubmit() {
  const router = useRouter();
  return (params: URLSearchParams, options: { method: string; action: string; preventScrollReset?: boolean }) =>
    router.navigate({ href: options.action + (params.size ? "?" + params.toString() : ""), resetScroll: !options.preventScrollReset });
}
