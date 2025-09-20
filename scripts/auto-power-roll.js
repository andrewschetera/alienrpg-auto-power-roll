/**
 * Alien RPG - Auto Power Roll Module (Button Version)
 * Versão corrigida que funciona independente de token selecionado
 * Com suporte a mensagem de arma descarregada
 */

class AlienAutoPowerRollButton {
    constructor() {
        this.moduleName = "alien-auto-power-roll";
        this.moduleTitle = "Alien RPG - Auto Power Roll";
        this.processedMessages = new Set();
    }

    init() {
        console.log(`${this.moduleTitle} | Inicializando versão com botão...`);
        
        // Registrar configurações com tradução
        this._registerSettings();
    }

    _registerSettings() {
        // Configuração para ativar/desativar o botão
        game.settings.register(this.moduleName, "enableAutoPowerButton", {
            name: game.i18n.localize("ALIEN_AUTO_POWER.Settings.EnableButtonTitle"),
            hint: game.i18n.localize("ALIEN_AUTO_POWER.Settings.EnableButtonHint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });

        // Apenas armas ranged
        game.settings.register(this.moduleName, "onlyRangedWeapons", {
            name: game.i18n.localize("ALIEN_AUTO_POWER.Settings.OnlyRangedTitle"),
            hint: game.i18n.localize("ALIEN_AUTO_POWER.Settings.OnlyRangedHint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });

        // Estilo do botão
        game.settings.register(this.moduleName, "buttonStyle", {
            name: game.i18n.localize("ALIEN_AUTO_POWER.Settings.ButtonStyleTitle"),
            hint: game.i18n.localize("ALIEN_AUTO_POWER.Settings.ButtonStyleHint"),
            scope: "world",
            config: true,
            type: String,
            choices: {
                "default": game.i18n.localize("ALIEN_AUTO_POWER.ButtonStyle.Default"),
                "prominent": game.i18n.localize("ALIEN_AUTO_POWER.ButtonStyle.Prominent"),
                "minimal": game.i18n.localize("ALIEN_AUTO_POWER.ButtonStyle.Minimal")
            },
            default: "default"
        });

        // Auto-ocultar botão
        game.settings.register(this.moduleName, "autoHideButton", {
            name: game.i18n.localize("ALIEN_AUTO_POWER.Settings.AutoHideButtonTitle"),
            hint: game.i18n.localize("ALIEN_AUTO_POWER.Settings.AutoHideButtonHint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });
    }

    ready() {
        console.log(`${this.moduleTitle} | Pronto! Versão com botão ativa.`);
        
        // Verificar se estamos no sistema certo
        if (game.system.id !== "alienrpg") {
            console.warn(`${this.moduleTitle} | Sistema não é Alien RPG (${game.system.id})`);
            return;
        }
        
        // Hook para adicionar botões em mensagens de ataque
        Hooks.on("createChatMessage", async (message) => {
            await this._handleChatMessage(message);
        });

        // Hook para processar cliques nos botões
        Hooks.on("renderChatMessage", (message, html, data) => {
            this._addButtonListeners(message, html);
        });

        console.log(`${this.moduleTitle} | Hooks registrados com sucesso.`);
    }

    async _handleChatMessage(message) {
        // 🔒 Só o GM cria as mensagens extras
        if (!game.user.isGM) return;
        try {
            // Debug inicial
            console.log(`${this.moduleTitle} | Processando mensagem:`, message.id);
            
            // Verificações básicas
            if (!game.settings.get(this.moduleName, "enableAutoPowerButton")) {
                console.log(`${this.moduleTitle} | Módulo desabilitado nas configurações`);
                return;
            }
            
            if (game.system.id !== "alienrpg") {
                console.log(`${this.moduleTitle} | Sistema não é Alien RPG`);
                return;
            }

            // Evitar processar a mesma mensagem múltiplas vezes
            if (this.processedMessages.has(message.id)) {
                console.log(`${this.moduleTitle} | Mensagem já processada: ${message.id}`);
                return;
            }
            this.processedMessages.add(message.id);

            // 🚫 Checar flag para evitar duplicatas
            if (message.getFlag(this.moduleName, "powerButtonCreated")) return;
            await message.setFlag(this.moduleName, "powerButtonCreated", true);

            // Limpar cache se ficar muito grande
            if (this.processedMessages.size > 100) {
                this.processedMessages.clear();
            }

            // Verificar se tem rolls (importante para ataques)
            if (!message.rolls?.length) {
                console.log(`${this.moduleTitle} | Mensagem sem rolls`);
                return;
            }

            // **CORREÇÃO PRINCIPAL**: Obter ator de múltiplas formas
            const actor = this._getActorFromMessage(message);
            if (!actor) {
                console.log(`${this.moduleTitle} | Nenhum ator encontrado na mensagem`);
                return;
            }

            console.log(`${this.moduleTitle} | Ator encontrado: ${actor.name} (ID: ${actor.id})`);

            // Tentar múltiplas formas de encontrar a arma
            const weapon = this._findWeaponFromMessage(message, actor);
            if (!weapon) {
                console.log(`${this.moduleTitle} | Nenhuma arma encontrada`);
                // Debug adicional
                console.log("Flags da mensagem:", message.flags);
                console.log("Speaker:", message.speaker);
                console.log("Conteúdo snippet:", message.content?.substring(0, 200));
                return;
            }

            console.log(`${this.moduleTitle} | Arma encontrada: ${weapon.name} (${weapon.id})`);

            // Verificar se é ranged (se configurado)
            if (game.settings.get(this.moduleName, "onlyRangedWeapons")) {
                if (!this._isRangedWeapon(weapon)) {
                    console.log(`${this.moduleTitle} | Arma não é ranged: ${weapon.name}`);
                    return;
                }
            }

            // Verificar se tem power
            const powerValue = this._getPowerValue(weapon);
            console.log(`${this.moduleTitle} | Power da arma: ${powerValue}`);
            
            // **NOVA LÓGICA**: Se power for 0, mostrar mensagem de arma descarregada
            if (powerValue <= 0) {
                console.log(`${this.moduleTitle} | Arma sem power, mostrando mensagem de descarregada: ${weapon.name}`);
                console.log(`${this.moduleTitle} | Chamando _addWeaponDischargedMessage em 500ms...`);
                setTimeout(() => {
                    console.log(`${this.moduleTitle} | Executando setTimeout para mensagem de descarregada`);
                    this._addWeaponDischargedMessage(message, actor, weapon);
                }, 500);
                return;
            }

            // Adicionar botão à mensagem após um pequeno delay
            console.log(`${this.moduleTitle} | Adicionando botão para: ${weapon.name}`);
            setTimeout(() => {
                this._addPowerSupplyButton(message, actor, weapon);
            }, 500);

        } catch (error) {
            console.error(`${this.moduleTitle} | Erro ao processar mensagem:`, error);
        }
    }

    /**
     * NOVA FUNÇÃO: Obtém o ator da mensagem de múltiplas formas
     * Não depende de token selecionado
     */
    _getActorFromMessage(message) {
        // Método 1: ChatMessage.getSpeakerActor (padrão)
        let actor = ChatMessage.getSpeakerActor(message.speaker);
        if (actor) {
            console.log(`${this.moduleTitle} | Ator encontrado via getSpeakerActor: ${actor.name}`);
            return actor;
        }

        // Método 2: Via speaker.actor (ID direto)
        if (message.speaker?.actor) {
            actor = game.actors.get(message.speaker.actor);
            if (actor) {
                console.log(`${this.moduleTitle} | Ator encontrado via speaker.actor: ${actor.name}`);
                return actor;
            }
        }

        // Método 3: Via speaker.token (pegar ator do token)
        if (message.speaker?.token) {
            const token = canvas.tokens?.get(message.speaker.token);
            if (token?.actor) {
                console.log(`${this.moduleTitle} | Ator encontrado via token: ${token.actor.name}`);
                return token.actor;
            }
            
            // Tentar pegar token de scene
            const scene = game.scenes.get(message.speaker.scene);
            if (scene) {
                const tokenDoc = scene.tokens.get(message.speaker.token);
                if (tokenDoc?.actor) {
                    console.log(`${this.moduleTitle} | Ator encontrado via scene token: ${tokenDoc.actor.name}`);
                    return tokenDoc.actor;
                }
            }
        }

        // Método 4: Via flags da mensagem
        if (message.flags?.alienrpg?.actorId) {
            actor = game.actors.get(message.flags.alienrpg.actorId);
            if (actor) {
                console.log(`${this.moduleTitle} | Ator encontrado via flags: ${actor.name}`);
                return actor;
            }
        }

        // Método 5: Via user (ator atribuído ao usuário)
        if (message.user) {
            const user = game.users.get(message.user);
            if (user?.character) {
                console.log(`${this.moduleTitle} | Ator encontrado via usuário: ${user.character.name}`);
                return user.character;
            }
        }

        // Método 6: Procurar no conteúdo HTML por data-actor-id
        const content = message.content || "";
        const actorMatch = content.match(/data-actor-id="([^"]+)"/);
        if (actorMatch) {
            actor = game.actors.get(actorMatch[1]);
            if (actor) {
                console.log(`${this.moduleTitle} | Ator encontrado via HTML: ${actor.name}`);
                return actor;
            }
        }

        console.log(`${this.moduleTitle} | Nenhum ator encontrado. Speaker:`, message.speaker);
        return null;
    }

    /**
     * Adiciona mensagem de arma descarregada quando power = 0
     */
    async _addWeaponDischargedMessage(message, actor, weapon) {
        try {
            console.log(`${this.moduleTitle} | Iniciando criação de mensagem de descarregada para: ${weapon.name}`);
            
            const weaponName = weapon.name;
            
            // Criar HTML da mensagem de arma descarregada
            const dischargedHtml = this._createDischargedMessageHtml(weaponName);
            console.log(`${this.moduleTitle} | HTML da mensagem criado:`, dischargedHtml.substring(0, 100) + "...");
            
            // Criar nova mensagem com o aviso
            const dischargedMessage = {
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: dischargedHtml,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flags: {
                    [this.moduleName]: {
                        isDischargedMessage: true,
                        actorId: actor.id,
                        weaponId: weapon.id,
                        originalMessageId: message.id
                    }
                }
            };

            console.log(`${this.moduleTitle} | Dados da mensagem preparados:`, {
                user: dischargedMessage.user,
                speaker: dischargedMessage.speaker,
                hasContent: !!dischargedMessage.content,
                contentLength: dischargedMessage.content.length
            });

            const createdMessage = await ChatMessage.create(dischargedMessage);
            console.log(`${this.moduleTitle} | Mensagem de arma descarregada criada com sucesso:`, createdMessage.id);

        } catch (error) {
            console.error(`${this.moduleTitle} | Erro ao adicionar mensagem de descarregada:`, error);
            console.error(`${this.moduleTitle} | Stack trace:`, error.stack);
            
            // Fallback: criar mensagem simples
            try {
                console.log(`${this.moduleTitle} | Tentando fallback com mensagem simples...`);
                const fallbackMessage = {
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker({ actor: actor }),
                    content: `<div style="background: #8b0000; color: white; padding: 10px; text-align: center; border-radius: 5px;">
                        <strong>⚠️ ARMA DESCARREGADA</strong><br>
                        ${weapon.name} - Power: 0 (Vazio)<br>
                        <em>Recarga Necessária</em>
                    </div>`,
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER
                };
                
                const fallbackCreated = await ChatMessage.create(fallbackMessage);
                console.log(`${this.moduleTitle} | Mensagem fallback criada:`, fallbackCreated.id);
                
            } catch (fallbackError) {
                console.error(`${this.moduleTitle} | Erro no fallback também:`, fallbackError);
            }
        }
    }

    /**
     * Cria o HTML da mensagem de arma descarregada (versão simplificada)
     */
    _createDischargedMessageHtml(weaponName) {
        const warningTitle = game.i18n.localize("ALIEN_AUTO_POWER.WeaponDischarged") || "⚠️ ARMA DESCARREGADA";
        const warningMessage = game.i18n.format("ALIEN_AUTO_POWER.WeaponDischargedMessage", {weaponName}) || `A ${weaponName} não possui energia restante e não pode ser disparada.`;
        const powerEmpty = game.i18n.localize("ALIEN_AUTO_POWER.PowerEmpty") || "Power: 0 (Vazio)";
        const reloadRequired = game.i18n.localize("ALIEN_AUTO_POWER.ReloadRequired") || "Recarga Necessária";

        return `
            <div class="alien-discharged-container" style="
                background: linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%);
                border: 2px solid #8b0000;
                border-radius: 8px;
                padding: 12px;
                margin: 5px 0;
                text-align: center;
                box-shadow: 0 2px 8px rgba(139, 0, 0, 0.4);
            ">
                <div style="
                    color: #ff6b6b;
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    font-size: 16px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                    text-shadow: 0 0 4px #ff6b6b;
                ">
                    ${warningTitle}
                </div>
                
                <div style="
                    color: #ff9999;
                    font-size: 14px;
                    margin-bottom: 8px;
                    font-weight: bold;
                ">
                    💥 ${weaponName} - ${powerEmpty}
                </div>
                
                <div style="
                    color: #ffcccc;
                    font-size: 12px;
                    font-style: italic;
                    margin-bottom: 8px;
                    line-height: 1.3;
                ">
                    ${warningMessage}
                </div>
                
                <div style="
                    color: #ff8888;
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                    font-weight: bold;
                    text-transform: uppercase;
                    padding: 4px 8px;
                    background: rgba(139, 0, 0, 0.3);
                    border-radius: 4px;
                    border: 1px solid #8b0000;
                    display: inline-block;
                ">
                    🔧 ${reloadRequired}
                </div>
            </div>
        `;
    }

    /**
     * Adiciona botão de Power Supply à mensagem de chat
     */
    async _addPowerSupplyButton(message, actor, weapon) {
        try {
            const powerValue = this._getPowerValue(weapon);
            const buttonStyle = game.settings.get(this.moduleName, "buttonStyle");
            
            // Criar HTML do botão baseado no estilo
            const buttonHtml = this._createButtonHtml(weapon, powerValue, buttonStyle);
            
            // Criar nova mensagem com o botão
            const buttonMessage = {
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: buttonHtml,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flags: {
                    [this.moduleName]: {
                        isPowerButton: true,
                        actorId: actor.id,
                        weaponId: weapon.id,
                        powerValue: powerValue,
                        originalMessageId: message.id
                    }
                }
            };

            const createdMessage = await ChatMessage.create(buttonMessage);
            console.log(`${this.moduleTitle} | Botão adicionado com sucesso para: ${weapon.name}`);

        } catch (error) {
            console.error(`${this.moduleTitle} | Erro ao adicionar botão:`, error);
        }
    }

    /**
     * Cria o HTML do botão baseado no estilo
     */
    _createButtonHtml(weapon, powerValue, style) {
        const weaponName = weapon.name;
        
        let buttonClass = "alien-power-button";
        let containerClass = "alien-power-container";
        let buttonText = game.i18n.localize("ALIEN_AUTO_POWER.ButtonText");
        
        switch (style) {
            case "prominent":
                buttonClass += " prominent";
                buttonText = game.i18n.format("ALIEN_AUTO_POWER.ButtonTextProminent", {weaponName});
                break;
            case "minimal":
                buttonClass += " minimal";
                buttonText = game.i18n.localize("ALIEN_AUTO_POWER.ButtonTextMinimal");
                break;
            default:
                buttonText = game.i18n.localize("ALIEN_AUTO_POWER.ButtonText");
                break;
        }

        return `
            <div class="${containerClass}" data-weapon-name="${weaponName}" data-actor-id="${weapon.parent.id}">
                <div class="power-supply-info">
                    <strong>💥 ${weaponName}</strong> - ${game.i18n.localize("ALIEN_AUTO_POWER.PowerLabel")}: ${powerValue}
                </div>
                <button class="${buttonClass}" 
                        data-action="power-supply" 
                        data-tooltip="${game.i18n.localize("ALIEN_AUTO_POWER.ButtonTooltip")}"
                        style="
                            background: linear-gradient(90deg, #2d5016 0%, #3e6b1f 25%, #2d5016 50%, #3e6b1f 75%, #2d5016 100%) !important;
                            background-size: 20px 100% !important;
                            border: 2px solid #4a7c59 !important;
                            border-radius: 4px !important;
                            color: #a3d977 !important;
                            font-family: 'Courier New', monospace !important;
                            font-weight: bold !important;
                            font-size: 13px !important;
                            padding: 8px 16px !important;
                            cursor: pointer !important;
                            text-shadow: 0 0 2px #4a7c59, 0 0 4px #4a7c59 !important;
                            box-shadow: inset 0 1px 0 #5a8c69, 0 2px 4px rgba(0,0,0,0.3) !important;
                            text-transform: uppercase !important;
                            letter-spacing: 1px !important;
                            min-width: 120px !important;
                            position: relative !important;
                            overflow: hidden !important;
                        ">
                    ${buttonText}
                </button>
                <style>
                    .alien-power-container {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
                        border: 2px solid #0f3460 !important;
                        border-radius: 8px !important;
                        padding: 10px !important;
                        margin: 5px 0 !important;
                        text-align: center !important;
                        box-shadow: 0 2px 8px rgba(15, 52, 96, 0.3) !important;
                    }
                    
                    .alien-power-container .power-supply-info {
                        color: #e16428 !important;
                        font-size: 12px !important;
                        margin-bottom: 8px !important;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
                    }
                    
                    .alien-power-container button.alien-power-button:hover {
                        color: #ffffff !important;
                        text-shadow: 0 0 4px #4a7c59, 0 0 8px #4a7c59, 0 0 12px #4a7c59 !important;
                        border-color: #5a8c69 !important;
                        box-shadow: inset 0 1px 0 #6a9c79, 0 0 8px rgba(74, 124, 89, 0.5) !important;
                        animation: alien-interference 0.1s infinite !important;
                    }
                    
                    @keyframes alien-interference {
                        0% { text-shadow: 0 0 4px #4a7c59, 0 0 8px #4a7c59, 0 0 12px #4a7c59; }
                        25% { text-shadow: 1px 0 4px #4a7c59, -1px 0 8px #4a7c59, 0 0 12px #4a7c59; }
                        50% { text-shadow: -1px 0 4px #4a7c59, 1px 0 8px #4a7c59, 0 0 12px #4a7c59; }
                        75% { text-shadow: 0 1px 4px #4a7c59, 0 -1px 8px #4a7c59, 0 0 12px #4a7c59; }
                        100% { text-shadow: 0 0 4px #4a7c59, 0 0 8px #4a7c59, 0 0 12px #4a7c59; }
                    }
                    
                    .alien-power-container button.alien-power-button:active {
                        transform: translateY(1px) !important;
                        box-shadow: inset 0 1px 0 #4a7c59, 0 1px 2px rgba(0,0,0,0.3) !important;
                    }
                    
                    .alien-power-container button.alien-power-button.prominent {
                        padding: 12px 24px !important;
                        font-size: 14px !important;
                        min-width: 200px !important;
                    }
                    
                    .alien-power-container button.alien-power-button.minimal {
                        padding: 6px 12px !important;
                        font-size: 16px !important;
                        min-width: 40px !important;
                        border-radius: 4px !important;
                    }
                    
                    .alien-power-container button.alien-power-button:disabled {
                        background: #333 !important;
                        border-color: #555 !important;
                        color: #666 !important;
                        cursor: not-allowed !important;
                        transform: none !important;
                        opacity: 0.6 !important;
                        text-shadow: none !important;
                        box-shadow: none !important;
                        animation: none !important;
                    }
                </style>
            </div>
        `;
    }

    /**
     * Adiciona listeners para os botões
     */
    _addButtonListeners(message, html) {
        const powerButtons = html.find('[data-action="power-supply"]');
        
        powerButtons.on('click', async (event) => {
            event.preventDefault();
            
            const button = $(event.currentTarget);
            const flags = message.flags?.[this.moduleName];
            
            if (!flags?.isPowerButton) return;
            
            const actor = game.actors.get(flags.actorId);
            const weapon = actor?.items.get(flags.weaponId);
            
            if (!actor || !weapon) {
                ui.notifications.error(game.i18n.localize("ALIEN_AUTO_POWER.WeaponNotFound"));
                return;
            }
            
            // Desabilitar botão para evitar cliques múltiplos
            button.prop('disabled', true);
            button.text(game.i18n.localize("ALIEN_AUTO_POWER.Rolling"));
            
            try {
                await this._executePowerSupply(actor, weapon);
                
                // Ocultar botão se configurado
                if (game.settings.get(this.moduleName, "autoHideButton")) {
                    button.closest('.alien-power-container').fadeOut(300);
                } else {
                    button.text(game.i18n.localize("ALIEN_AUTO_POWER.Rolled"));
                    button.css('background', '#28a745');
                }
                
            } catch (error) {
                console.error(`${this.moduleTitle} | Erro ao executar Power Supply:`, error);
                button.prop('disabled', false);
                button.text(game.i18n.localize("ALIEN_AUTO_POWER.Error"));
                button.css('background', '#dc3545');
                
                setTimeout(() => {
                    button.text(game.i18n.localize("ALIEN_AUTO_POWER.ButtonText"));
                    button.css('background', '');
                }, 2000);
            }
        });
    }

    /**
     * Executa o Power Supply usando método nativo
     */
    async _executePowerSupply(actor, weapon) {
        if (actor.consumablesCheck && typeof actor.consumablesCheck === "function") {
            const powerLabel = game.i18n.localize("ALIEN_AUTO_POWER.PowerSupplyRoll");
            await actor.consumablesCheck(actor, 'power', powerLabel, weapon.id);
            
            console.log(`${this.moduleTitle} | Power Supply executado: ${weapon.name}`);
        } else {
            console.error(`${this.moduleTitle} | Método consumablesCheck não encontrado no ator`);
            throw new Error(game.i18n.localize("ALIEN_AUTO_POWER.MethodNotFound"));
        }
    }

    /**
     * Encontra a arma na mensagem com múltiplas estratégias
     */
    _findWeaponFromMessage(message, actor) {
        // Estratégia 1: Procurar ID nas flags (Alien RPG específico)
        const flags = message.flags?.alienrpg;
        if (flags) {
            const itemId = flags.itemId || flags.item || flags.weaponId || flags.weapon;
            if (itemId) {
                const item = actor.items.get(itemId);
                if (item?.type === "weapon") {
                    console.log(`${this.moduleTitle} | Arma encontrada via flags: ${item.name}`);
                    return item;
                }
            }
        }

        // Estratégia 2: Procurar no conteúdo HTML
        const content = message.content || "";
        const htmlMatch = content.match(/data-item-id="([^"]+)"/);
        if (htmlMatch) {
            const item = actor.items.get(htmlMatch[1]);
            if (item?.type === "weapon") {
                console.log(`${this.moduleTitle} | Arma encontrada via HTML: ${item.name}`);
                return item;
            }
        }

        // Estratégia 3: Procurar por rolls de arma
        if (message.rolls?.length) {
            for (const roll of message.rolls) {
                if (roll.options?.weapon || roll.options?.itemId) {
                    const weaponId = roll.options.weapon || roll.options.itemId;
                    const item = actor.items.get(weaponId);
                    if (item?.type === "weapon") {
                        console.log(`${this.moduleTitle} | Arma encontrada via roll options: ${item.name}`);
                        return item;
                    }
                }
            }
        }

        // Estratégia 4: Procurar por nome no conteúdo
        const weaponNameMatch = content.match(/data-weapon-name="([^"]+)"/);
        if (weaponNameMatch) {
            const weaponName = weaponNameMatch[1];
            const weapon = actor.items.find(item => 
                item.type === "weapon" && item.name === weaponName
            );
            if (weapon) {
                console.log(`${this.moduleTitle} | Arma encontrada por nome: ${weapon.name}`);
                return weapon;
            }
        }

        // Estratégia 5: Procurar por padrões específicos do Alien RPG
        const alienRpgMatch = content.match(/<h3[^>]*>([^<]+)<\/h3>/);
        if (alienRpgMatch) {
            const potentialWeaponName = alienRpgMatch[1].trim();
            const weapon = actor.items.find(item => 
                item.type === "weapon" && item.name === potentialWeaponName
            );
            if (weapon) {
                console.log(`${this.moduleTitle} | Arma encontrada por h3: ${weapon.name}`);
                return weapon;
            }
        }

        // Debug: listar todas as armas do ator
        const weapons = actor.items.filter(item => item.type === "weapon");
        console.log(`${this.moduleTitle} | Armas disponíveis no ator:`, weapons.map(w => w.name));

        return null;
    }

    /**
     * Verifica se é arma ranged com múltiplas verificações
     */
    _isRangedWeapon(weapon) {
        const data = weapon.system || weapon.data?.data || {};
        
        // Verificar range
        const range = data.range?.value || data.attributes?.range?.value || 0;
        if (range > 0) return true;
        
        // Verificar tipo
        const type = data.type?.value || data.attributes?.type?.value || "";
        if (type.toLowerCase().includes("ranged")) return true;
        
        // Verificar categoria
        const category = data.category?.value || data.attributes?.category?.value || "";
        if (category.toLowerCase().includes("ranged")) return true;
        
        return false;
    }

    /**
     * Obtém valor de power com múltiplas verificações
     */
    _getPowerValue(weapon) {
        const data = weapon.system || weapon.data?.data || {};
        
        // Múltiplas tentativas de encontrar power
        return parseInt(
            data.power?.value || 
            data.attributes?.power?.value || 
            data.power?.current ||
            data.attributes?.power?.current ||
            0
        );
    }
}

// Inicialização
Hooks.once("init", () => {
    console.log("🔋 Alien Auto Power Roll - Iniciando...");
    window.alienAutoPowerRoll = new AlienAutoPowerRollButton();
    window.alienAutoPowerRoll.init();
});

Hooks.once("ready", () => {
    if (window.alienAutoPowerRoll) {
        window.alienAutoPowerRoll.ready();
        console.log("🔋 Alien Auto Power Roll - Versão com botão ativa!");
        console.log("💡 Agora funciona independente de token selecionado!");
        console.log("💡 Inclui mensagem de arma descarregada quando power = 0!");
        console.log("💡 Para debug, verifique o console durante ataques com armas.");
    } else {
        console.error("🔋 Alien Auto Power Roll - Falha na inicialização!");
    }
});
