import type { FormEvent } from "react";

import { API_BASE } from "../lib/api";
import type { LoginResponse } from "../types";

type HeroPanelProps = {
  session: LoginResponse | null;
  username: string;
  password: string;
  loading: boolean;
  error: string;
  activeTenantName: string;
  activeQuote: string;
  quoteCount: number;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: (event: FormEvent) => void;
  onLogout: () => void;
};

export function HeroPanel(props: HeroPanelProps) {
  const {
    session,
    username,
    password,
    loading,
    error,
    activeTenantName,
    activeQuote,
    quoteCount,
    onUsernameChange,
    onPasswordChange,
    onLogin,
    onLogout
  } = props;

  return (
    <aside className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">ClassManager Next</p>
        <h1>新前端最小读界面</h1>
        <p className="muted">
          这个界面直接读取新系统 API，不再依赖旧版浏览器大状态。当前接通了登录、班级、
          学生、积分汇总、积分流水和排行榜。
        </p>
      </div>

      {!session ? (
        <form className="login-card" onSubmit={onLogin}>
          <label>
            <span>用户名</span>
            <input value={username} onChange={(event) => onUsernameChange(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "登录中..." : "进入新系统"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      ) : (
        <div className="session-card">
          <p>当前账号</p>
          <strong>{session.user.displayName || session.user.username}</strong>
          <span>{activeTenantName}</span>
          {activeQuote ? <span>今日语录 · {quoteCount} 条</span> : null}
          <code>{API_BASE}</code>
          <button type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      )}

      {session && activeQuote ? (
        <div className="session-card">
          <p>今日语录</p>
          <strong>{activeQuote}</strong>
          <span>来自当前班级语录库</span>
        </div>
      ) : null}
    </aside>
  );
}
