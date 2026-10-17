import { useCallback, useEffect, useMemo, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Layout, type TabId } from "./components/Layout";
import { WalletSpoiler } from "./components/WalletSpoiler";
import { NeonSiege } from "./game/NeonSiege";
import { AwnRun } from "./game/run/AwnRun";
import type { RunResult } from "./game/run/runEngine";
import type { DifficultyId } from "./game/difficulty";
import type { ShipId } from "./game/ships";
import { getShip } from "./game/ships";
import { useI18n } from "./i18n/I18nContext";
import { isGameComing, useAppStatus } from "./lib/appStatus";
import {
  applyRunRewards,
  applySiegeKillReward,
  ensureStarterGrant,
  type RunPowerId,
} from "./lib/gameEconomy";
import { consumeRunLife } from "./lib/runLives";
import { registerMiniappHolder } from "./lib/holderRegistry";
import { submitScore } from "./lib/leaderboard";
import { applyUpgrades, loadOwned } from "./lib/upgrades";
import { haptic } from "./lib/telegram";
import { ClaimScreen } from "./screens/Claim";
import { GamesScreen } from "./screens/Games";
import { HomeScreen } from "./screens/Home";
import { LeaderboardScreen } from "./screens/Leaderboard";
import { RoadmapScreen } from "./screens/Roadmap";
import { WalletScreen } from "./screens/Wallet";

export type { TabId };

export default function App() {
  const { t } = useI18n();
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  useAppStatus(); // fetch app-status.json on load (cache-bust)

  useEffect(() => {
    if (!wallet) return;
    void registerMiniappHolder(wallet);
  }, [wallet]);

  const [tab, setTab] = useState<TabId>("home");
  const [shipId, setShipId] = useState<ShipId>("viper_mk2");
  const [difficulty, setDifficulty] = useState<DifficultyId>("easy");
  const [playingMode, setPlayingMode] = useState<"siege" | "run" | null>(null);
  const [siegeKey, setSiegeKey] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [ecoTick, setEcoTick] = useState(0);
  const [runPowers, setRunPowers] = useState<RunPowerId[]>([]);

  // Disconnect mid-game → kick back to lobby
  useEffect(() => {
    if (!wallet && playingMode) {
      setPlayingMode(null);
      setTab("games");
    }
  }, [wallet, playingMode]);

  const stats = useMemo(
    () => applyUpgrades(loadOwned(wallet)),
    [wallet, playingMode],
  );

  const requireWallet = useCallback(async () => {
    if (wallet) return true;
    await tonConnectUI.openModal();
    return false;
  }, [wallet, tonConnectUI]);

  const exitToGames = useCallback(() => {
    setPlayingMode(null);
    setTab("games");
  }, []);

  const onSiegeOver = useCallback(
    (p: { score: number; wave: number; level: number; minedAwn: number }) => {
      setLastScore(p.score);
      if (p.minedAwn > 0) {
        applySiegeKillReward(wallet, p.minedAwn);
        setEcoTick((n) => n + 1);
      }
      const ship = getShip(shipId);
      const name =
        wallet?.slice(0, 6) ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.username ||
        "Pilot";
      submitScore({
        name,
        score: p.score,
        ship: ship.name,
        wallet: wallet || undefined,
      });
      haptic("heavy");
    },
    [shipId, wallet],
  );

  const onRunOver = useCallback(
    (r: RunResult) => {
      applyRunRewards(wallet, r.gold, r.mined);
      setEcoTick((n) => n + 1);
      setLastScore(r.score);
      haptic("heavy");
    },
    [wallet],
  );

  if (playingMode === "siege" && wallet) {
    return (
      <Layout tab="games" onTab={setTab} hideNav playing>
        <NeonSiege
          key={siegeKey}
          shipId={shipId}
          stats={stats}
          difficulty={difficulty}
          onExit={exitToGames}
          onRestart={() => {
            setLastScore(null);
            setSiegeKey((k) => k + 1);
          }}
          onGameOver={onSiegeOver}
        />
        {lastScore !== null && (
          <p className="hint center">
            {t.game.lastRun}: {lastScore} · {t.nav.board}
          </p>
        )}
      </Layout>
    );
  }

  if (playingMode === "run" && wallet) {
    return (
      <Layout tab="games" onTab={setTab} hideNav playing>
        <AwnRun
          key={runKey}
          powers={runPowers}
          wallet={wallet}
          onExit={exitToGames}
          onRestart={() => {
            const life = consumeRunLife(wallet);
            if (!life.ok) {
              exitToGames();
              return;
            }
            setLastScore(null);
            setRunKey((k) => k + 1);
            setEcoTick((n) => n + 1);
          }}
          onOver={onRunOver}
          onPowersChange={(p) => {
            setRunPowers([...p]);
            setEcoTick((n) => n + 1);
          }}
        />
        {lastScore !== null && (
          <p className="hint center">
            {t.game.lastRun}: {lastScore}
          </p>
        )}
      </Layout>
    );
  }

  const locked = !wallet;

  return (
    <Layout tab={tab} onTab={setTab}>
      {tab === "home" && <HomeScreen />}
      {tab === "wallet" && (
        <WalletSpoiler locked={locked}>
          <WalletScreen />
        </WalletSpoiler>
      )}
      {tab === "claim" && (
        <WalletSpoiler locked={locked}>
          <ClaimScreen />
        </WalletSpoiler>
      )}
      {tab === "games" && (
        <WalletSpoiler locked={locked}>
          <GamesScreen
            selected={shipId}
            onSelect={setShipId}
            difficulty={difficulty}
            onDifficulty={setDifficulty}
            ecoTick={ecoTick}
            onOpenRoadmap={() => {
              setTab("roadmap");
              haptic("light");
            }}
            onLaunchSiege={() => {
              void (async () => {
                if (!(await requireWallet())) return;
                if (isGameComing("siege")) return;
                setLastScore(null);
                setPlayingMode("siege");
                haptic("medium");
              })();
            }}
            onLaunchRun={() => {
              void (async () => {
                if (!(await requireWallet())) return;
                if (isGameComing("run")) return;
                const life = consumeRunLife(wallet);
                if (!life.ok) {
                  setEcoTick((n) => n + 1);
                  return;
                }
                const eco = ensureStarterGrant(wallet);
                setRunPowers([...eco.powers]);
                setLastScore(null);
                setPlayingMode("run");
                setEcoTick((n) => n + 1);
                haptic("medium");
              })();
            }}
          />
        </WalletSpoiler>
      )}
      {tab === "roadmap" && (
        <WalletSpoiler locked={locked}>
          <RoadmapScreen />
        </WalletSpoiler>
      )}
      {tab === "board" && (
        <WalletSpoiler locked={locked}>
          <LeaderboardScreen />
        </WalletSpoiler>
      )}
    </Layout>
  );
}
