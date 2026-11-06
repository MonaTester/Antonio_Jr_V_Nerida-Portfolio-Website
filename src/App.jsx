import React, { useCallback, useEffect, useRef, useState } from "react";
import RoguelikeGame from "./RoguelikeCampaign.jsx";

const API_URL = (import.meta.env.VITE_GAME_API_URL ?? "").replace(/\/+$/, "");
const PROJECT_DESCRIPTION =
  "A small event-driven programming language built for games, brought to life in bounded misere Nim. Take 1-3 stones from one heap; the player who takes the last stone loses.";
const CLASS_DEMOS = {
  warrior: {
    name: "WARRIOR", role: "Strength · Defense", color: "warrior",
    skills: ["Quick strike", "Shield wall", "Last stand"],
    descriptions: ["A focused melee hit.", "Reduce the next hit.", "Trade health for a heavy strike."],
  },
  mage: {
    name: "MAGE", role: "Magic · Control", color: "mage",
    skills: ["Arc bolt", "Frost bind", "Mana surge"],
    descriptions: ["Strike from range.", "Freeze a nearby target.", "Restore a little health."],
  },
  rogue: {
    name: "ROGUE", role: "Agility · Critical", color: "rogue",
    skills: ["Quick strike", "Shadow step", "Risk / reward passive"],
    descriptions: ["A swift, precise attack.", "Dodge the next attack.", "Critical hits hit harder, but leave you exposed."],
  },
};
const PROGRESSION_CHOICES = {
  power: { title: "Power node", description: "Take +1 attack into the next floor.", icon: "✦" },
  risk: { title: "Risk node", description: "Gain +2 attack, lose 1 health. Choices have a cost.", icon: "!" },
  reward: { title: "Supply cache", description: "Recover up to 2 health before the next floor.", icon: "◆" },
  elite: { title: "Elite challenge", description: "Risk 1 health to claim +2 attack for the next floors.", icon: "★" },
};

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (requestError) {
    throw new Error("The game server is unavailable. Start the Python game API and try again.");
  }
  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch (parseError) {
    throw new Error("The game server returned an invalid response. Check that the Python game API is running.");
  }
  if (!response.ok) throw new Error(payload.error ?? "The game service returned an error.");
  return payload;
}

function GameDialog({ open, onClose }) {
  const dialogRef = useRef(null);
  const [mode, setMode] = useState("ai");
  const [game, setGame] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const startGame = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const newGame = await apiRequest("/games", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setGame(newGame);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!open || !game?.id || game.finished) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const updatedGame = await apiRequest(`/games/${game.id}`);
        if (active) {
          setGame(updatedGame);
          if (updatedGame.error) setError(updatedGame.error);
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    };
    const interval = window.setInterval(poll, 350);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [open, game?.id, game?.finished]);

  const closeGame = useCallback(async () => {
    const gameId = game?.id;
    setGame(null);
    setError("");
    onClose();
    if (gameId) {
      try {
        await apiRequest(`/games/${gameId}`, { method: "DELETE" });
      } catch (requestError) {
        console.error("Could not close the game session.", requestError);
      }
    }
  }, [game?.id, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const handleCancel = (event) => {
      event.preventDefault();
      void closeGame();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [closeGame]);

  const sendMove = async (value) => {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      setGame(await apiRequest(`/games/${game.id}/input`, {
        method: "POST",
        body: JSON.stringify({ value }),
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resetGame = async () => {
    const previousId = game?.id;
    setGame(null);
    if (previousId) {
      try {
        await apiRequest(`/games/${previousId}`, { method: "DELETE" });
      } catch {
        setError("Could not close the previous game cleanly.");
      }
    }
    await startGame();
  };

  const isHeapPrompt = game?.prompt?.startsWith("Choose a heap");
  const isAmountPrompt = game?.prompt?.startsWith("How many");
  const maxTake = game?.heaps?.[game?.selectedHeap - 1] ?? 0;
  const isAiTurn = mode === "ai" && game?.activePlayer === 2 && !game?.finished;

  return (
    <dialog
      className="game-dialog"
      ref={dialogRef}
      onClick={(event) => {
        if (event.target === dialogRef.current) void closeGame();
      }}
      aria-labelledby="game-title"
    >
      <div className="game-shell">
        <header className="game-header">
          <div>
            <p className="eyebrow">INTERACTIVE PROJECT</p>
            <h2 id="game-title">Pebble: Game of Nim</h2>
          </div>
          <button className="icon-button" onClick={() => void closeGame()} aria-label="Close game">
            ×
          </button>
        </header>

        {!game ? (
          <section className="game-setup" aria-label="Game setup">
            <div className="setup-art" aria-hidden="true">
              <span>●</span><span>●</span><span>●</span><i />
              <span>●</span><span>●</span><i />
              <span>●</span><span>●</span><span>●</span><span>●</span>
            </div>
            <p className="eyebrow">THREE HEAPS · LAST STONE LOSES</p>
            <h3>A quiet game of sharp decisions.</h3>
            <p className="muted">
              Take 1 to 3 stones from one heap each turn. Avoid taking the very last stone.
            </p>
            <div className="mode-picker" aria-label="Choose opponent">
              <button
                className={mode === "ai" ? "mode-option selected" : "mode-option"}
                onClick={() => setMode("ai")}
                aria-pressed={mode === "ai"}
              >
                <span>Play vs Pebble AI</span><small>A thoughtful computer opponent</small>
              </button>
              <button
                className={mode === "two_player" ? "mode-option selected" : "mode-option"}
                onClick={() => setMode("two_player")}
                aria-pressed={mode === "two_player"}
              >
                <span>Two players</span><small>Take turns at the same screen</small>
              </button>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="button button-primary start-button" onClick={() => void startGame()} disabled={busy}>
              {busy ? "Starting..." : "Start a game"}
            </button>
          </section>
        ) : (
          <section className="game-board" aria-label="Nim game">
            <div className="game-status-row">
              <div>
                <p className="eyebrow">{mode === "ai" ? "VS PEBBLE AI" : "LOCAL TWO PLAYER"}</p>
                <h3>{game.finished ? (game.winner ? `Player ${game.winner} wins!` : "Round complete") : isAiTurn ? "Pebble is thinking..." : `Player ${game.activePlayer}'s turn`}</h3>
              </div>
              <span className="turn-badge">LAST STONE LOSES</span>
            </div>

            <div className="heaps">
              {game.heaps.map((count, index) => (
                <section className="heap-card" key={index} aria-label={`Heap ${index + 1}: ${count} stones`}>
                  <div className="heap-heading">
                    <span>HEAP 0{index + 1}</span>
                    <span>{count} {count === 1 ? "stone" : "stones"}</span>
                  </div>
                  <div className="stones" aria-hidden="true">
                    {Array.from({ length: count }, (_, stone) => (
                      <span className={`stone ${(stone + index) % 5 === 4 ? "flower-stone" : ""}`} key={stone} />
                    ))}
                    {count === 0 && <span className="empty-heap">empty</span>}
                  </div>
                  {isHeapPrompt && game.canMove ? (
                    <button className="button heap-button" onClick={() => void sendMove(index + 1)} disabled={busy || count === 0}>
                      Choose heap
                    </button>
                  ) : <span className="heap-spacer" />}
                </section>
              ))}
            </div>

            <div className="move-area" aria-live="polite">
              {isAmountPrompt && game.canMove ? (
                <>
                  <p>How many stones will you take?</p>
                  <div className="amount-options">
                    {Array.from({ length: Math.min(maxTake, 3) }, (_, index) => index + 1).map((amount) => (
                      <button className="button amount-button" key={amount} onClick={() => void sendMove(amount)} disabled={busy}>
                        Take {amount}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p>{game.finished ? "Start another round or close the game." : game.status}</p>
              )}
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            {game.error && <p className="error-message" role="alert">Game error: {game.error}</p>}
            {game.logs?.length > 0 && (
              <details className="game-log">
                <summary>Game log</summary>
                <ul>{game.logs.slice(-8).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>
              </details>
            )}
            <div className="game-footer">
              <button className="button button-quiet" onClick={() => void resetGame()} disabled={busy}>
                New game
              </button>
              <button className="button button-quiet" onClick={() => void closeGame()}>
                Close game
              </button>
            </div>
          </section>
        )}
      </div>
    </dialog>
  );
}

function App() {
  const [gameOpen, setGameOpen] = useState(false);
  const [roguelikeOpen, setRoguelikeOpen] = useState(false);
  const [contactNotice, setContactNotice] = useState("");
  const [heroConcept, setHeroConcept] = useState("combat");
  const [demoClass, setDemoClass] = useState("rogue");
  const [usedDemoSkills, setUsedDemoSkills] = useState([]);
  const [progressDemo, setProgressDemo] = useState({
    run: 7, depth: 3, phase: "start", branch: "combat", choice: "",
    attack: 0, health: 3, choices: 0, subclass: false,
  });

  useEffect(() => {
    if (!contactNotice) return undefined;
    const timeout = window.setTimeout(() => setContactNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [contactNotice]);

  const copyContactNumber = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText("+639566391688");
        } catch {
          copyContactNumberFallback();
        }
      } else {
        copyContactNumberFallback();
      }
      setContactNotice("Contact number copied: +63 956 639 1688");
    } catch (error) {
      console.error("Could not copy the contact number.", error);
      setContactNotice("Could not copy automatically. Number: +63 956 639 1688");
    }
  };

  const copyContactNumberFallback = () => {
    const input = document.createElement("textarea");
    input.value = "+639566391688";
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    let copied;
    try {
      copied = document.execCommand("copy");
    } finally {
      input.remove();
    }
    if (!copied) throw new Error("The browser denied clipboard access.");
  };

  const moveProgressionPreview = (node) => {
    setProgressDemo((current) => {
      if (current.phase === "result") {
        if (node !== "continue") return current;
        return {
          ...current,
          depth: current.depth + 1,
          phase: (current.depth + 1) % 5 === 0 ? "boss" : "start",
          branch: "",
          choice: "",
          subclass: false,
        };
      }
      if (node === "start" && current.phase === "start") {
        return { ...current, phase: current.depth % 5 === 0 ? "boss" : "branch" };
      }
      if (node === "boss" && current.phase === "boss") {
        return {
          ...current,
          phase: "result",
          choice: "boss",
          attack: current.attack + 2,
          choices: current.choices + 1,
          subclass: true,
        };
      }
      if (["combat", "utility"].includes(node) && current.phase === "branch") {
        return { ...current, phase: "reward", branch: node };
      }
      if (["power", "risk", "reward", "elite"].includes(node) && current.phase === "reward") {
        if (current.branch === "combat" && !["power", "risk"].includes(node)) return current;
        if (current.branch === "utility" && !["reward", "elite"].includes(node)) return current;
        return {
          ...current,
          phase: "result",
          choice: node,
          attack: current.attack + (node === "power" ? 1 : node === "risk" || node === "elite" ? 2 : 0),
          health: Math.max(1, Math.min(5, current.health + (node === "risk" || node === "elite" ? -1 : node === "reward" ? 2 : 0))),
          choices: current.choices + 1,
        };
      }
      return current;
    });
  };
  const previewClass = CLASS_DEMOS[demoClass];
  const chooseDemoClass = (classId) => {
    setDemoClass(classId);
    setUsedDemoSkills([]);
  };
  const toggleDemoSkill = (index) => {
    setUsedDemoSkills((current) => current.includes(index)
      ? current.filter((skill) => skill !== index)
      : [...current, index]);
  };

  return (
    <>
      <div className="site-wrap">
        <header className="site-header">
          <a className="wordmark" href="#home" aria-label="Aeghiknoluvxy home">
            <img className="brand-logo" src="/aeghiknoluvxy-logo.png" alt="" />
            <span className="wordmark-name">Aeghiknoluvxy</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#about">About</a>
            <a href="#skills">Skills</a>
            <a href="#projects">Projects</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="header-cta" href="#projects">Explore my work <span>↘</span></a>
        </header>

        <main>
          <section className="hero section" id="home">
            <div className="hero-copy">
              <p className="eyebrow"><span className="availability-dot" /> GAMEPLAY SYSTEMS · LUA · ROBLOX</p>
              <h1>Worlds built<br /><span>with logic.</span></h1>
              <p className="hero-intro">
                I like figuring out what makes a game tick: the rules and scripts behind its combat, enemies, and progression. I build those kinds of systems in Roblox with Lua.
              </p>
              <div className="hero-actions">
                <div className="hero-action-stack">
                  <a className="button button-primary" href="#projects">Explore my projects <span>↘</span></a>
                  <a
                    className="button button-resume"
                    href="/Antonio-Jr-V-Nerida-Resume.pdf"
                    download="Antonio-Jr-V-Nerida-Resume.pdf"
                  >
                    Download my resume <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <a className="text-link" href="#about">A little about me <span>↓</span></a>
              </div>
              <div className="hero-meta">
                <span>BSIT STUDENT</span><span>BUILDING WITH CURIOSITY</span>
              </div>
            </div>
            <div className="hero-visual" aria-label="Interactive previews of my game development interests">
              <div className="game-preview">
                <div className="preview-topbar">
                  <span className="preview-brand"><i /> AEGHIKNOLUVXY / SYSTEMS</span>
                  <span className="preview-mode">{heroConcept === "combat" ? "COMBAT" : heroConcept === "classes" ? "CLASS DESIGN" : "PROGRESSION"}</span>
                </div>
                {heroConcept === "combat" && (
                  <>
                    <div className="preview-status">
                      <div><span>RUN</span><strong>07</strong></div>
                      <div><span>DEPTH</span><strong>03</strong></div>
                      <div className="preview-lives"><span>VITALS</span><strong>♥ ♥ ♥</strong></div>
                    </div>
                    <div className="dungeon-map" role="img" aria-label="Combat system concept: dungeon map with player, enemies, and treasure">
                      {Array.from({ length: 35 }, (_, index) => {
                        const isPlayer = index === 23;
                        const isEnemy = index === 11 || index === 32;
                        const isTreasure = index === 17;
                        const isPath = [8, 9, 10, 16, 18, 23, 24, 25, 31, 32].includes(index);
                        return (
                          <span
                            className={`map-tile${isPath ? " tile-path" : ""}${isPlayer ? " tile-player" : ""}${isEnemy ? " tile-enemy" : ""}${isTreasure ? " tile-treasure" : ""}`}
                            key={index}
                          >
                            {isPlayer ? "✦" : isEnemy ? "!" : isTreasure ? "◇" : ""}
                          </span>
                        );
                      })}
                    </div>
                    <div className="preview-footer">
                      <span><i className="legend-player" /> YOU</span>
                      <span><i className="legend-enemy" /> ENEMY AI</span>
                      <span><i className="legend-loot" /> LOOT</span>
                      <strong>TURN 04</strong>
                    </div>
                    <div className="preview-code">
                      <span>SYSTEMS IN PLAY</span>
                      <span>COMBAT <i /> AI <i /> LOOT</span>
                    </div>
                  </>
                )}
                {heroConcept === "classes" && (
                  <div className="class-concept" aria-label="Interactive class design preview">
                    <div className="concept-heading"><span>CHOOSE YOUR CLASS</span><span>YOUR RUN · YOUR BUILD</span></div>
                    <div className="class-roster">
                      {Object.entries(CLASS_DEMOS).map(([classId, character]) => (
                        <button
                          className={`class-card ${character.color}-card${demoClass === classId ? " is-active" : ""}`}
                          key={classId}
                          onClick={() => chooseDemoClass(classId)}
                          aria-pressed={demoClass === classId}
                        >
                          <span className="class-symbol">{classId === "warrior" ? "⚔" : classId === "mage" ? "✧" : "⌁"}</span>
                          <strong>{character.name}</strong><small>{character.role}</small>
                          <em>{demoClass === classId ? "SELECTED" : "CHOOSE"}</em>
                        </button>
                      ))}
                    </div>
                    <div className="class-loadout">
                      <span>{previewClass.name} LOADOUT · CLICK A SKILL TO TEST</span>
                      {previewClass.skills.map((skill, index) => (
                        <button
                          className="class-skill-row"
                          key={`${demoClass}-${skill}`}
                          onClick={() => toggleDemoSkill(index)}
                          aria-pressed={usedDemoSkills.includes(index)}
                          title={previewClass.descriptions[index]}
                        >
                          <i>{["Ⅰ", "Ⅱ", "Ⅲ"][index]}</i><span>{skill}</span>
                          <b>{usedDemoSkills.includes(index) ? "USED" : index === 2 ? "PASSIVE" : "READY"}</b>
                        </button>
                      ))}
                    </div>
                    <p className="class-demo-note" aria-live="polite">
                      {usedDemoSkills.length ? `${usedDemoSkills.length} ${usedDemoSkills.length === 1 ? "skill" : "skills"} tested · ${previewClass.role}` : `${previewClass.name}: ${previewClass.role}. Select a skill to see its state change.`}
                    </p>
                  </div>
                )}
                {heroConcept === "progression" && (
                  <div className="progression-concept" aria-label="Interactive roguelike progression preview">
                    <div className="concept-heading">
                      <span>RUN {String(progressDemo.run).padStart(2, "0")} · DEPTH {String(progressDemo.depth).padStart(2, "0")}</span>
                      <span>{progressDemo.depth % 5 === 0 ? "BOSS FLOOR" : "PERMADEATH ACTIVE"}</span>
                    </div>
                    <div className="skill-tree">
                      <svg viewBox="0 0 360 178" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M180 22 L90 82 M180 22 L270 82 M90 82 L54 148 M90 82 L180 148 M270 82 L180 148 M270 82 L306 148" />
                      </svg>
                      <button
                        className={`tree-node node-start${progressDemo.phase === "start" || progressDemo.phase === "boss" ? " is-available" : progressDemo.phase === "result" ? " is-visited" : ""}`}
                        onClick={() => moveProgressionPreview(progressDemo.phase === "boss" ? "boss" : "start")}
                        disabled={!["start", "boss"].includes(progressDemo.phase)}
                        aria-label={progressDemo.phase === "boss" ? "Resolve boss floor" : "Begin this floor"}
                      >{progressDemo.phase === "boss" ? "BOSS" : "RUN"}</button>
                      <button className={`tree-node node-combat${progressDemo.branch === "combat" ? " is-visited" : ""}${progressDemo.phase === "branch" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("combat")} disabled={progressDemo.phase !== "branch"} aria-label="Choose combat route">⚔<small>COMBAT</small></button>
                      <button className={`tree-node node-utility${progressDemo.branch === "utility" ? " is-visited" : ""}${progressDemo.phase === "branch" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("utility")} disabled={progressDemo.phase !== "branch"} aria-label="Choose utility route">◇<small>UTILITY</small></button>
                      <button className={`tree-node node-power${progressDemo.choice === "power" ? " is-visited" : ""}${progressDemo.phase === "reward" && progressDemo.branch === "combat" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("power")} disabled={progressDemo.phase !== "reward" || progressDemo.branch !== "combat"} aria-label="Choose power upgrade">✦<small>POWER</small></button>
                      <button className={`tree-node node-risk${progressDemo.choice === "risk" ? " is-visited" : ""}${progressDemo.phase === "reward" && progressDemo.branch === "combat" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("risk")} disabled={progressDemo.phase !== "reward" || progressDemo.branch !== "combat"} aria-label="Choose risk reward">!<small>RISK</small></button>
                      <button className={`tree-node node-reward${progressDemo.choice === "reward" ? " is-visited" : ""}${progressDemo.phase === "reward" && progressDemo.branch === "utility" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("reward")} disabled={progressDemo.phase !== "reward" || progressDemo.branch !== "utility"} aria-label="Choose supply cache">◆<small>SUPPLY</small></button>
                      <button className={`tree-node node-elite${progressDemo.choice === "elite" ? " is-visited" : ""}${progressDemo.phase === "reward" && progressDemo.branch === "utility" ? " is-available" : ""}`} onClick={() => moveProgressionPreview("elite")} disabled={progressDemo.phase !== "reward" || progressDemo.branch !== "utility"} aria-label="Choose elite challenge">★<small>ELITE</small></button>
                    </div>
                    <div className="progression-feedback" aria-live="polite">
                      <span>{progressDemo.phase === "start" ? "Choose RUN to enter this floor." :
                        progressDemo.phase === "branch" ? "Choose your route: combat or utility." :
                          progressDemo.phase === "reward" ? `Route: ${progressDemo.branch}. Choose its reward.` :
                            progressDemo.choice === "boss" ? "Boss cleared. A subclass path opens." :
                              progressDemo.choice ? PROGRESSION_CHOICES[progressDemo.choice].description : "A boss guards every fifth floor."}</span>
                      {progressDemo.phase === "result" && <button onClick={() => moveProgressionPreview("continue")}>
                        {progressDemo.subclass ? "Descend · subclass unlocked" : "Descend to next floor"} ↘
                      </button>}
                    </div>
                    <div className="run-consequence">
                      <span>♥ {progressDemo.health}</span><span>⚔ +{progressDemo.attack}</span>
                      <i /><strong>{progressDemo.choices} CHOICE{progressDemo.choices === 1 ? "" : "S"} CARRIED</strong><i />
                      <span>{progressDemo.phase === "result" && progressDemo.subclass ? "SUBCLASS" : "PERMADEATH"}</span>
                    </div>
                  </div>
                )}
                <div className="preview-code">
                  <span>BUILT WITH INTENTION</span>
                  <span>ROBLOX <i /> LUA <i /> SYSTEMS</span>
                </div>
                <div className="preview-caption"><span>MY GAME DEV WORLD</span><span>BUILT ONE SYSTEM AT A TIME</span></div>
              </div>
              <div className="concept-picker" role="group" aria-label="Choose a game development visual concept">
                <button className={heroConcept === "combat" ? "concept-tab is-selected" : "concept-tab"} onClick={() => setHeroConcept("combat")} aria-pressed={heroConcept === "combat"}>
                  <span>01</span> Combat & AI
                </button>
                <button className={heroConcept === "classes" ? "concept-tab is-selected" : "concept-tab"} onClick={() => setHeroConcept("classes")} aria-pressed={heroConcept === "classes"}>
                  <span>02</span> Class design
                </button>
                <button className={heroConcept === "progression" ? "concept-tab is-selected" : "concept-tab"} onClick={() => setHeroConcept("progression")} aria-pressed={heroConcept === "progression"}>
                  <span>03</span> Roguelike progression
                </button>
              </div>
              <button className="hero-game-launch" onClick={() => setRoguelikeOpen(true)}>
                <span><i /> PLAY THE PROTOTYPE</span><strong>Enter the dungeon ↗</strong>
              </button>
            </div>
            <a className="scroll-cue" href="#about"><span /> SCROLL TO DISCOVER</a>
          </section>

          <section className="about section" id="about">
            <div className="section-label"><span>01</span> ABOUT ME</div>
            <div className="about-content">
              <p className="eyebrow">GAME SYSTEMS · LUA SCRIPTING · ROBLOX</p>
              <h2>I love the logic<br /><span>behind the game.</span></h2>
              <p className="about-description">
                I’m Antonio Jr. V. Nerida, a BSIT student at the Technological Institute of the Philippines, with over six years of experience in game development. My main focus is Roblox and Lua. I enjoy building the systems behind play—from combat, enemy AI, trading, and character classes to roguelike progression where permadeath gives every choice weight. I’m also interested in moderation and managing projects. In my free time, I enjoy creating visual effects, rendering animations, making graphic art, and working on 3D assets and maps. I’m currently learning more about web development and scripting, and I’m open to collaborating with other game developers.
              </p>
              <ul className="about-facts">
                <li>Game Developer</li>
                <li>Web Developer</li>
                <li>App Developer</li>
              </ul>
            </div>
            <div className="about-side">
              <img className="profile-photo" src="/profile.png" alt="Antonio Jr. V. Nerida" />
              <p>Game developer alias: Aeghiknoluvxy</p>
            </div>
          </section>

          <section className="skills section" id="skills">
            <div className="section-label"><span>02</span> LANGUAGES & TOOLS</div>
            <div className="skills-content">
              <p className="eyebrow">WHAT I WORK WITH</p>
              <h2>Tools for making<br /><span>ideas playable.</span></h2>
              <p className="skills-intro">
                I use these languages and web technologies across game scripting, programming, and web development. Lua is my main tool for Roblox game systems.
              </p>
              <div className="skill-grid">
                <div className="skill-card"><span className="skill-mark">Lu</span><span className="skill-name">Lua</span><span className="skill-use">Roblox scripting</span></div>
                <div className="skill-card"><span className="skill-mark">Py</span><span className="skill-name">Python</span><span className="skill-use">Programming & scripting</span></div>
                <div className="skill-card"><span className="skill-mark">Ja</span><span className="skill-name">Java</span><span className="skill-use">Programming</span></div>
                <div className="skill-card"><span className="skill-mark">C+</span><span className="skill-name">C++</span><span className="skill-use">Programming</span></div>
                <div className="skill-card"><span className="skill-mark">C</span><span className="skill-name">C</span><span className="skill-use">Programming</span></div>
                <div className="skill-card"><span className="skill-mark">JS</span><span className="skill-name">JavaScript</span><span className="skill-use">Web interactions</span></div>
                <div className="skill-card"><span className="skill-mark">H</span><span className="skill-name">HTML</span><span className="skill-use">Web structure</span></div>
                <div className="skill-card"><span className="skill-mark">#</span><span className="skill-name">CSS</span><span className="skill-use">Web styling</span></div>
                <div className="skill-card"><span className="skill-mark">Sw</span><span className="skill-name">Swift</span><span className="skill-use">Programming</span></div>
                <div className="skill-card"><span className="skill-mark">Re</span><span className="skill-name">React</span><span className="skill-use">UI development</span></div>
                <div className="skill-card"><span className="skill-mark">Pb</span><span className="skill-name">Pebble</span><span className="skill-use">Custom game language</span></div>
              </div>
              <div className="tools-row"><span>TOOLS</span><span>Visual Studio Code</span><span>PyCharm</span></div>
            </div>
          </section>

          <section className="projects section" id="projects">
            <div className="section-label"><span>03</span> SELECTED WORK</div>
            <div className="projects-heading">
              <div><p className="eyebrow">A FEW THINGS I’VE MADE</p><h2>Projects <span>& experiments.</span></h2></div>
              <p>Small ideas, built with care.<br />More work coming soon.</p>
            </div>
            <article className="project-card">
              <div className="project-art" aria-hidden="true">
                <div className="art-label">PEBBLE<br /><span>ORIGINAL</span></div>
                <div className="art-heaps">
                  <div>{[0, 1, 2].map((stone) => <i key={stone} />)}</div>
                  <div>{[0, 1, 2, 3].map((stone) => <i key={stone} />)}</div>
                  <div>{[0, 1, 2, 3, 4].map((stone) => <i key={stone} />)}</div>
                </div>
                <span className="art-index">PROJECT 001</span>
              </div>
              <div className="project-info">
                <div className="project-topline"><span>GAME DEVELOPMENT · PROGRAMMING LANGUAGE</span><span>2026</span></div>
                <h3>Pebble: Game of Nim</h3>
                <p>{PROJECT_DESCRIPTION}</p>
                <div className="tags"><span>Python</span><span>Custom language</span><span>Game AI</span></div>
                <button className="button button-primary play-button" onClick={() => setGameOpen(true)}>
                  Play the game <span>↗</span>
                </button>
                <p className="project-note">The original game logic runs in Pebble, my event-driven language. This playable web version uses the same Pebble program.</p>
              </div>
            </article>
            <div className="coming-soon"><span>MORE PROJECTS</span><span>In the works <i>✳</i></span></div>
          </section>

          <section className="contact section" id="contact">
            <div className="section-label"><span>04</span> SAY HELLO</div>
            <div className="contact-body">
              <p className="eyebrow">OPEN TO GAME DEVELOPMENT COLLABORATIONS</p>
              <h2>Let’s build<br /><span>something fun.</span></h2>
              <p>I’m interested in meeting fellow developers, sharing ideas, and working together on game projects.</p>
              <div className="contact-links">
                <a
                  className="button button-primary"
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=antoniojrnerida08%40gmail.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Email me <span>↗</span>
                </a>
                <button className="button button-outline" onClick={() => void copyContactNumber()}>
                  Contact me <span>⧉</span>
                </button>
              </div>
              <div className="contact-details">
                <a href="mailto:antoniojrnerida08@gmail.com">antoniojrnerida08@gmail.com</a>
                <a href="tel:+639566391688">+63 956 639 1688</a>
                <a href="https://github.com/MonaTester" target="_blank" rel="noreferrer">GitHub · @MonaTester ↗</a>
              </div>
              <p className="contact-note">Pronouns: he/him</p>
              <p className={`contact-toast${contactNotice ? " is-visible" : ""}`} role="status" aria-live="polite">
                {contactNotice}
              </p>
            </div>
            <div className="contact-mark" aria-hidden="true">✳</div>
          </section>
        </main>

        <footer className="site-footer">
          <a className="wordmark" href="#home" aria-label="Aeghiknoluvxy home"><img className="brand-logo" src="/aeghiknoluvxy-logo.png" alt="" /><span className="wordmark-name">Aeghiknoluvxy</span></a>
          <span>DESIGNED & BUILT BY ANTONIO NERIDA · 2026</span>
          <a href="#home">BACK TO TOP ↑</a>
        </footer>
      </div>
      <GameDialog open={gameOpen} onClose={() => setGameOpen(false)} />
      <RoguelikeGame open={roguelikeOpen} onClose={() => setRoguelikeOpen(false)} />
    </>
  );
}

export default App;
