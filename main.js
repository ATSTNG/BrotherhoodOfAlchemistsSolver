const EPS = 0.0000001;

class StateStrategyResult {
    constructor(aux_prob=1) {
        this.reset_zero(aux_prob);
    }

    reset_zero(aux_prob=1) {
        this.value = 0;
        this.aux_prob = aux_prob;
        this.next_move_elixir = 0;
        this.next_move_alchemist = 0;
        this.elixir_prob_ = (new Array(16)).fill(0);
    }

    elixir_prob(row, col) {
        return this.elixir_prob_[ (row-1) + (col-1)*4 ];
    }

    elixir_prob_set(row, col, value) {
        this.elixir_prob_[ (row-1) + (col-1)*4 ] = value;
    }

    add_state(ssr, coef, added_fixed_value) {
        this.value += coef * (ssr.value + added_fixed_value);
        this.aux_prob += coef * ssr.aux_prob;
        
        this.add_elixir_state(ssr, coef);
    }

    add_elixir_state(ssr, coef) {
        for (var i = 0; i < 16; i++) {
            this.elixir_prob_[i] += coef * ssr.elixir_prob_[i];
        }
    }

    copy_state(ssr) {
        this.reset_zero();

        this.aux_prob = 0;
        this.add_state(ssr, 1, 0);
    }

    compare_to(ssr, added_fixed_value=0) {
        if (this.value > ssr.value + added_fixed_value + EPS) return +1;
        if (this.value < ssr.value + added_fixed_value - EPS) return -1;

        if (this.aux_prob > ssr.aux_prob + EPS) return +1;
        if (this.aux_prob < ssr.aux_prob - EPS) return -1;

        return 0;
    }
}

class BrotherhoodOfAlchemistsSolver {
    constructor() {
        this.potion_table = document.getElementById("potiontable");
        this.event_log_container = document.getElementById("eventlogcontainer");

        this.event_sequence = new Array();

        // elixirs information
        this.elixir_info = Array.from(Array(5), () => new Array(5));

        this.presetElixir(1, 1, "mag_wil", "Elixir of Mysticism", "+3 Magic <br> +3 Willpower");
        this.presetElixir(2, 1, "danger_sense", "Elixir of the Savior", "+4 to all saving throws");
        this.presetElixir(3, 1, "all_stat", "Elixir of Mastery", "+4 Stat points");
        this.presetElixir(4, 1, "displacement_shield", "Elixir of Invulnerability", "");

        this.presetElixir(1, 2, "dex_cun", "Elixir of the Fox ", " +3 Dexterity <br> +3 Cunning");
        this.presetElixir(2, 2, "evasion", "Elixir of Avoidance ", " +6 Defense <br> +6 Ranged Defense");
        this.presetElixir(3, 2, "precise_strikes", "Elixir of Precision ", " +4% Physical Crit");
        this.presetElixir(4, 2, "lifebinding_emerald", "Lifebinding Emerald", "");
        
        this.presetElixir(1, 3, "str_con", "Elixir of Brawn", " +3 Strength <br> +3 Constitution");
        this.presetElixir(2, 3, "armour_training", "Elixir of Stoneskin", " +4 Armour");
        this.presetElixir(3, 3, "healing_light", "Elixir of Foundations", " +2 Generic Talent points");
        this.presetElixir(4, 3, "willful_tormenter", "Taint of Purging", "");
        
        this.presetElixir(1, 4, "lightning", "Elixir of Explosive Force", " +4% Spell Crit");
        this.presetElixir(2, 4, "lucky_day", "Elixir of Serendipity", " +5 Luck");
        this.presetElixir(3, 4, "radiance", "Elixir of Focus", " +2 Class Talent points");
        this.presetElixir(4, 4, "infusion__wild_growth", "Infusion of Wild Growth", "");

        // set default values
        this.reset();

        this.recomputeDynamicProgramming();

        this.updateFromEventSequence();
    }

    realEventCount() {
        var res = 0;

        for (let ev of this.event_sequence) {
            if ( !ev.is_focus_event) res += 1;
        }

        return res;
    }

    getFocusEvent() {
        for (let ev of this.event_sequence) {
            if (ev.is_focus_event) return ev;
        }

        return {row: 0, col: 0, is_focus_event: false};
    }

    alchemistName(alchemist) {
        return this.tableCell(0, alchemist).innerHTML;
    }

    tableCell(row, col) {
        return this.potion_table.rows[row].cells[col];
    }

    cell(row, col) {
        var table_cell = this.tableCell(row, col);
        
        return table_cell.children[0];
    }

    *allCells() {
        for (let row of [1, 2, 3, 4]) {
            for (let col of [1, 2, 3, 4]) {
                yield this.cell(row, col);
            }
        }
    }

    stateFinishedAlchemists(state) {
        var result = [];

        for (let alchemist of [1,2,3,4]) {
            var shift = 3 * (alchemist-1);
            if (((state >> shift) & 7) == 7) {
                result += 1;
            }
        }

        return result;
    }

    stateQuestIsOver(state) {
        return this.stateFinishedAlchemists(state).length > 0;
    }

    stateIsValid(state) {
        // this could be used to reduce the number of calculated unreachable states
        // but invalid states are linked together and it would be easier to
        // mark them all at once in a separate pass
        // anyway, optimizing the number of computed states is not required

        return true;
    }

    stateHasElixir(state, row, col) {
        var new_elixir_bit_idx = (row-1) + 3*(col-1);

        return ((state >> new_elixir_bit_idx) & 1) == 1;
    }

    stateAddElixir(state, row, col) {
        var old_locked_alchemist = (state >> 12);
        var old_elixir_bitmask = (state & ((1 << 12) - 1));

        var new_elixir_bit_idx = (row-1) + 3*(col-1);
        var new_locked_alchemist = (old_locked_alchemist == 0 ? col : 0);
        var new_elixir_bitmask = (old_elixir_bitmask | (1 << new_elixir_bit_idx));

        console.assert(new_elixir_bitmask > old_elixir_bitmask);

        return (new_locked_alchemist << 12) | new_elixir_bitmask;
    }

    stateSetLockedAlchemist(state, locked_alchemist) {
        return (locked_alchemist << 12) | (state & ((1 << 12)-1));
    }

    stateAsReadable(state) {
        var s = "";

        for (var i = 0; i < 12; i++) {
            s += (state % 2 == 0 ? "0" : "1");
            state = (state >> 1);
        }

        s += `-${state}`;

        return s;
    }

    updateElixirPlayerValues() {
        for (let row of [1, 2, 3, 4]) {
            for (let col of [1, 2, 3, 4]) {
                var cell = this.cell(row, col);
                var player_value_input = cell.children[1].children[0];
                var value = parseFloat(player_value_input.value);

                if (Number.isNaN(value)) {
                    player_value_input.value = "0";
                    value = 0;
                }

                this.elixir_info[row][col].player_value = value;
            }
        }
    }

    recomputeDynamicProgramming() {
        const BITMASK_SPACE = (1 << 12);
        const STATE_SPACE = BITMASK_SPACE * 5;

        const STRATEGY_OPTIMAL = 0;
        const STRATEGY_SAFEST = 1;
        const STRATEGY_MAX_GAMBLE = 2;
        const STRATEGIES = [0, 1, 2];

        // prepare popcount
        var precalc_popcount = (new Array(BITMASK_SPACE));
        precalc_popcount[0] = 0;
        for (var x = 1; x < BITMASK_SPACE; x += 1) {
            precalc_popcount[x] = precalc_popcount[x >> 1] + (x & 1);
        }

        // prepare elixir values
        this.updateElixirPlayerValues();

        // compute dp
        this.dp = (new Array(STATE_SPACE)).fill({computed: false});

        for (var elixir_bitmask = BITMASK_SPACE-1; elixir_bitmask >= 0; elixir_bitmask -= 1) {
            var popcount = precalc_popcount[elixir_bitmask];
            
            var locked_alchemists = (popcount % 2 == 0) ? [0] : [1,2,3,4];
            
            for (let locked_alchemist of locked_alchemists) {
                var state = elixir_bitmask + locked_alchemist*BITMASK_SPACE;

                if ( !this.stateIsValid(state)) {
                    continue;
                }

                this.dp[state] = {
                    computed: true,
                    s: [
                        new StateStrategyResult(),
                        new StateStrategyResult(0), // aux_prob = chance to get BETTER THAN min
                        new StateStrategyResult(1), // aux_prob = chance to get max
                    ],
                };

                if (this.stateQuestIsOver(state)) {
                    continue;
                }

                // acquire step, player's choice, always choose best
                if (locked_alchemist == 0) {
                    for (let alch of [1,2,3,4]) {
                        for (let elixir of [1,2,3]) {
                            if (this.stateHasElixir(state, elixir, alch)) continue;

                            var new_state = this.stateAddElixir(state, elixir, alch);
                            var new_state_is_final = this.stateQuestIsOver(new_state);
                            var final_reward = 4;

                            var new_state_added_player_value = 
                                this.elixir_info[elixir][alch].player_value +
                                (new_state_is_final ? this.elixir_info[final_reward][alch].player_value : 0);

                            const STRATEGIES_ORDER = [
                                STRATEGY_OPTIMAL,
                                STRATEGY_SAFEST,
                                STRATEGY_MAX_GAMBLE,
                            ];

                            for (let strategy of STRATEGIES_ORDER) {
                                var dp_state_s = this.dp[state].s[strategy];
                                var dp_new_state_s = this.dp[new_state].s[strategy];
                                var n_m_elixir = dp_state_s.next_move_elixir;
                                var n_m_alch = dp_state_s.next_move_alchemist;

                                var optimal_compare_result = -1;
                                if (n_m_elixir != 0 && n_m_alch != 0) {
                                    var selected_state = this.stateAddElixir(state, n_m_elixir, n_m_alch);
                                    var selected_state_is_final = this.stateQuestIsOver(selected_state);
                                    
                                    var selected_state_added_player_value = 
                                        this.elixir_info[n_m_elixir][n_m_alch].player_value +
                                        (selected_state_is_final ? this.elixir_info[final_reward][n_m_alch].player_value : 0);

                                    var dp_selected_state_optimal = this.dp[selected_state].s[STRATEGY_OPTIMAL];
                                    var dp_new_state_optimal = this.dp[new_state].s[STRATEGY_OPTIMAL];

                                    // selected_state + selected_state_added_player_value <=> new_state + new_state_added_player_value
                                    optimal_compare_result = dp_selected_state_optimal.compare_to(
                                        dp_new_state_optimal,
                                        new_state_added_player_value - selected_state_added_player_value
                                    );
                                }
                                
                                var s_compare_result = dp_state_s.compare_to(dp_new_state_s, new_state_added_player_value);

                                if((s_compare_result < 0) || (s_compare_result == 0 && optimal_compare_result < 0)) {
                                    dp_state_s.copy_state(dp_new_state_s);
                                    dp_state_s.value += new_state_added_player_value;
                                    dp_state_s.next_move_elixir = elixir;
                                    dp_state_s.next_move_alchemist = alch;

                                    dp_state_s.elixir_prob_set(elixir, alch, 1);
                                    if (new_state_is_final) dp_state_s.elixir_prob_set(final_reward, alch, 1);
                                }
                            }
                        }
                    }
                }

                // skip step, random choice
                if (locked_alchemist != 0) {
                    // set always-replaced starting values
                    this.dp[state].s[STRATEGY_SAFEST].value = Infinity;
                    this.dp[state].s[STRATEGY_MAX_GAMBLE].value = -Infinity;

                    for (let alch of [1,2,3,4]) {
                        if (alch == locked_alchemist) continue;

                        var possible_elixirs = 0;
                        for (let elixir of [1,2,3]) {
                            if ( !this.stateHasElixir(state, elixir, alch)) {
                                possible_elixirs += 1;
                            }
                        }
                        
                        var elixir_coef = (1 / 3) / possible_elixirs;

                        for (let elixir of [1,2,3]) {
                            if (this.stateHasElixir(state, elixir, alch)) continue;

                            var new_state = this.stateAddElixir(state, elixir, alch);

                            //console.log(this.stateAsReadable(state), this.stateAsReadable(new_state), locked_alchemist, alch);

                            // optimal strategy
                            this.dp[state].s[STRATEGY_OPTIMAL].add_state(
                                this.dp[new_state].s[STRATEGY_OPTIMAL],
                                elixir_coef,
                                0 /* no value added */
                            );

                            // safest strategy
                            var dp_state_s = this.dp[state].s[STRATEGY_SAFEST];
                            var dp_new_state_s = this.dp[new_state].s[STRATEGY_SAFEST];

                            dp_state_s.add_elixir_state(dp_new_state_s, elixir_coef);

                            if (dp_state_s.value > dp_new_state_s.value + EPS) {
                                dp_state_s.value = dp_new_state_s.value;
                                dp_state_s.aux_prob = 1;
                            }
                            if (Math.abs(dp_state_s.value - dp_new_state_s.value) < EPS) {
                                dp_state_s.aux_prob -= elixir_coef * (1 - dp_new_state_s.aux_prob);
                            }
                            
                            // max gamble strategy
                            var dp_state_s = this.dp[state].s[STRATEGY_MAX_GAMBLE];
                            var dp_new_state_s = this.dp[new_state].s[STRATEGY_MAX_GAMBLE];

                            dp_state_s.add_elixir_state(dp_new_state_s, elixir_coef);

                            if (dp_state_s.value < dp_new_state_s.value - EPS) {
                                dp_state_s.value = dp_new_state_s.value;
                                dp_state_s.aux_prob = 0;
                            }    
                            if (Math.abs(dp_state_s.value - dp_new_state_s.value) < EPS) {
                                dp_state_s.aux_prob += elixir_coef * dp_new_state_s.aux_prob;
                            }
                        }
                    }
                }
            }
        }

        // log results
        console.log(`[DP] computed states: ${this.dp.filter((x) => x.computed).length}`);
    }

    formatPercentage(x) {
        var r = 2 - 2*x;
        var g = 2*x;
        var b = 0;

        r = Math.round(255 * Math.min(1, Math.max(0, r)));
        g = Math.round(255 * Math.min(1, Math.max(0, g)));
        b = Math.round(255 * Math.min(1, Math.max(0, b)));

        var formatted_value = Math.round(x * 10000) / 100;

        return `<span style="color: rgb(${r},${g},${b});">${formatted_value}%</span>`;
    }

    formatValue(x) {
        return `${Math.round(x * 1000) / 1000}`;
    }

    render() {
        for (let row of [1, 2, 3, 4]) {
            for (let col of [1, 2, 3, 4]) {
                this.renderCell(row, col);
            }
        }

        this.renderEventLog();

        // render strategy & results
        var l_acquired_items = document.getElementById("labelacquireditems");
        var l_acquired_value = document.getElementById("labelacquiredvalue");
        var l_average_expected_value = document.getElementById("labelaverageexpectedvalue");
        var l_min_guaranteed_value = document.getElementById("labelminguaranteedvalue");
        var l_min_better_chance = document.getElementById("labelminbetterchance");
        var l_max_gamble_value = document.getElementById("labelmaxgamblevalue");
        var l_max_gamble_chance = document.getElementById("labelmaxgamblechance");
        var c_strategy_info = document.getElementById("strategyinfocontainer");
        var c_strategy_quest_is_over = document.getElementById("strategyquestisover");

        var dp_state = this.dp[this.current_state];

        const STRATEGY_OPTIMAL = 0;
        const STRATEGY_SAFEST = 1;
        const STRATEGY_MAX_GAMBLE = 2;
        
        l_acquired_items.innerHTML = this.formatValue(this.acquired_items);
        l_acquired_value.innerHTML = `${this.acquired_value}`;
        l_average_expected_value.innerHTML = this.formatValue(this.acquired_value + dp_state.s[STRATEGY_OPTIMAL].value);
        l_min_guaranteed_value.innerHTML = this.formatValue(this.acquired_value + dp_state.s[STRATEGY_SAFEST].value);
        l_min_better_chance.innerHTML = this.formatPercentage(dp_state.s[STRATEGY_SAFEST].aux_prob);
        l_max_gamble_value.innerHTML = this.formatValue(this.acquired_value + dp_state.s[STRATEGY_MAX_GAMBLE].value);
        l_max_gamble_chance.innerHTML = this.formatPercentage(dp_state.s[STRATEGY_MAX_GAMBLE].aux_prob);

        c_strategy_info.style.display = (this.quest_is_over ? "none" : "block");
        c_strategy_quest_is_over.style.display = (this.quest_is_over ? "block" : "none");
    }

    renderCell(row, col) {
        var elixir_info = this.elixir_info[row][col];
        var cell = this.cell(row, col);
        var status_msg = cell.children[2];
        var action_button = cell.children[3].children[0];
        var strategy_msg = cell.children[4];
        
        var real_event_count = this.realEventCount();
        var is_skip_step = (real_event_count % 2 == 1);
        var is_acquire_step = (real_event_count % 2 == 0);

        // general
        cell.classList.remove("potion_acquired");
        cell.classList.remove("potion_focused");
        cell.classList.remove("potion_skipped");

        status_msg.classList.remove("label-red");
        status_msg.classList.remove("label-green");
        status_msg.classList.remove("label-yellow");

        if (elixir_info.action_available && elixir_info.is_focused) {
            cell.classList.add("potion_focused");
            status_msg.innerHTML = (is_skip_step ? "Selected to skip" : "Selected to acquire");
            status_msg.classList.add("label-yellow");
        } else if (elixir_info.is_acquired) {
            cell.classList.add("potion_acquired");
            status_msg.innerHTML = "Acquired";
            status_msg.classList.add("label-green");
        } else if (elixir_info.is_skipped) {
            cell.classList.add("potion_skipped");
            status_msg.innerHTML = "Skipped";
            status_msg.classList.add("label-red");
        } else if (this.quest_is_over) {
            status_msg.innerHTML = "Quest is over";
        } else {
            status_msg.innerHTML = `Chance to get: ${this.formatPercentage(elixir_info.chance)}`;
        }

        // strategy message
        const strategy_messages = [
            "",
            "Optimal choice",
            "Safest choice",
            "Optimal and safest choice",
            "Max gamble choice",
            "Optimal and max gamble choice",
            "Safest and max gamble choice",
            "Best choice overall",
        ];

        strategy_msg.innerHTML = strategy_messages[elixir_info.strategy];

        // action button
        action_button.style.display = (elixir_info.action_available ? "block" : "none");
        action_button.classList.remove("btn-red");
        action_button.classList.remove("btn-green");
        
        if (is_skip_step) {
            action_button.innerHTML = "SKIP";
            action_button.classList.add("btn-red");
        }
        if (is_acquire_step) {
            action_button.innerHTML = "GET";
            action_button.classList.add("btn-green");
        }

    }

    renderEventLog() {
        var cancel_last_btn = document.getElementById("cancellastbtn");
        var msg;

        this.event_log_container.innerHTML = "";

        if (this.realEventCount() == 0) {
            this.event_log_container.innerHTML += "Acquired and skipped elixirs will be listed here";
            cancel_last_btn.style.display = "none";
        } else {
            cancel_last_btn.style.display = "inline-block";
        }

        for (var i = 0; i < this.event_sequence.length; i++) {
            var ev = this.event_sequence[i];
            var is_acquire_step = (i % 2 == 0);
            var is_skip_step = (i % 2 == 1);
            var vis_step_number = Math.floor(i / 2 + 1);
            var elixir_info = this.elixir_info[ev.row][ev.col];

            if (ev.is_focus_event) continue;

            if (is_acquire_step) {
                msg = `<div class="label-green">[${vis_step_number}] Acquired ${elixir_info.name} from ${this.alchemistName(ev.col)}</div>`;
            } else {
                msg = `<div class="label-red">[${vis_step_number}] Skipped ${elixir_info.name} for ${this.alchemistName(ev.col)}</div>`;
            }

            this.event_log_container.innerHTML += msg;
        }

        if (this.quest_is_over) {
            var finished_alchemist = this.finishedAlchemist();
            var final_reward_info = this.elixir_info[4][finished_alchemist];
            
            if (is_acquire_step) {
                msg = `<div class="label-green">${this.alchemistName(ev.col)} finished third elixir with your help. Final reward is ${final_reward_info.name}. Quest is over.</div>`;
            } else {
                msg = `<div class="label-red">${this.alchemistName(ev.col)} finished third elixir without your help. Final reward is skipped. Quest is over.</div>`;
            }

            this.event_log_container.innerHTML += msg;
        }
    }

    finishedAlchemist() {
        for (let alchemist of [1, 2, 3, 4]) {
            var finished_elixirs = 0;
            
            for (let elixir of [1, 2, 3]) {
                var elixir_info = this.elixir_info[elixir][alchemist];
                if (elixir_info.is_acquired || elixir_info.is_skipped) finished_elixirs += 1;
            }

            if (finished_elixirs == 3) return alchemist;
        }

        return 0;
    }

    reset() {
        for (let cur_row of [1, 2, 3, 4]) {
            for (let cur_col of [1, 2, 3, 4]) {
                var elixir_info = this.elixir_info[cur_row][cur_col];
                
                elixir_info.is_acquired = false;
                elixir_info.is_skipped = false;
                elixir_info.is_focused = false;
                elixir_info.action_available = (cur_row < 4);
            }
        }

        this.quest_is_over = false;
        this.locked_alchemist = 0;
        this.current_state = 0;
        this.focused_state = 0;

        this.acquired_items = 0;
        this.acquired_value = 0;
    }

    updateElixirInfo(current_state, focused_state) {
        // chances based on selected strategy
        var strategy = document.getElementById("selectedstrategy").value;

        //console.log(this.stateAsReadable(current_state), this.dp[current_state]);
        //console.log(this.stateAsReadable(focused_state), this.dp[focused_state]);

        for (let elixir of [1, 2, 3, 4]) {
            for (let alchemist of [1, 2, 3, 4]) {
                this.elixir_info[elixir][alchemist].chance = this.dp[focused_state].s[strategy].elixir_prob(elixir, alchemist);
            }
        }

        // focused elixir
        var focus_event = this.getFocusEvent();
        if (focus_event.is_focus_event) {
            this.elixir_info[focus_event.row][focus_event.col].is_focused = true;
        }

        // strategy infos
        for (let elixir of [1, 2, 3, 4]) {
            for (let alchemist of [1, 2, 3, 4]) {
                this.elixir_info[elixir][alchemist].strategy = 0;
            }
        }

        for (let strategy of [0,1,2]) {
            var elixir = this.dp[current_state].s[strategy].next_move_elixir;
            var alchemist = this.dp[current_state].s[strategy].next_move_alchemist;
        
            if (elixir == 0) continue;
            if (alchemist == 0) continue;
        
            this.elixir_info[elixir][alchemist].strategy |= (1 << strategy);
        }
    }

    updateFromEventSequence() {
        this.reset();

        for (var i = 0; i < this.event_sequence.length; i++) {
            var ev = this.event_sequence[i];
            var is_acquire_step = (i % 2 == 0);
            var is_skip_step = (i % 2 == 1);
            var elixir_info = this.elixir_info[ev.row][ev.col];
            
            this.focused_state = this.stateAddElixir(this.focused_state, ev.row, ev.col);
            
            if (ev.is_focus_event) continue;
            
            this.current_state = this.stateAddElixir(this.current_state, ev.row, ev.col);

            elixir_info.action_available = false;
            elixir_info.is_acquired = is_acquire_step;
            elixir_info.is_skipped = is_skip_step;
            
            this.locked_alchemist = (is_acquire_step ? ev.col : 0);            
        }

        var finished_alchemist = this.finishedAlchemist();
        if (finished_alchemist != 0) {
            var final_reward_info = this.elixir_info[4][finished_alchemist];
            final_reward_info.is_acquired = is_acquire_step;
            final_reward_info.is_skipped = is_skip_step;

            this.quest_is_over = true;
        }

        if (this.locked_alchemist > 0) {
            for (let elixir of [1, 2, 3]) {
                this.elixir_info[elixir][this.locked_alchemist].action_available = false;
            }
        }

        if (this.quest_is_over) {
            for (let elixir of [1, 2, 3]) {
                for (let alchemist of [1, 2, 3, 4]) {
                    this.elixir_info[elixir][alchemist].action_available = false;
                }
            }
        }

        for (let elixir of [1, 2, 3, 4]) {
            for (let alchemist of [1, 2, 3, 4]) {
                var elixir_info = this.elixir_info[elixir][alchemist];

                if (elixir_info.is_acquired) {
                    this.acquired_items += 1;
                    this.acquired_value += elixir_info.player_value;
                }
                
            }
        }

        this.updateElixirInfo(this.current_state, this.focused_state);

        this.render();
    }

    clearFocusEvents() {
        while (this.event_sequence.length > 0) {
            var last_event = this.event_sequence[this.event_sequence.length-1];

            if ( !last_event.is_focus_event) break;
            
            this.event_sequence.pop();
        }
    }

    addEvent(row, col, is_focus_event=false) {
        this.clearFocusEvents();

        this.event_sequence.push({row: row, col: col, is_focus_event: is_focus_event});

        this.updateFromEventSequence();
    }

    cancelLastEvent() {
        this.clearFocusEvents();

        if (this.event_sequence.length == 0) return;

        this.event_sequence.pop();

        this.updateFromEventSequence();
    }   

    focusCell(row, col) {
        this.clearFocusEvents();

        if (this.quest_is_over) return;

        var elixir_info = this.elixir_info[row][col];

        if (elixir_info.action_available) {   
            this.addEvent(row, col, true);
        } else {
            this.updateFromEventSequence();
        }
    }

    unfocusCells() {
        this.clearFocusEvents();
        this.updateFromEventSequence();
    }

    presetElixir(row, col, image, name, html) {
        var table_cell = this.tableCell(row, col);
        this.elixir_info[row][col] = {
            is_acquired: false,
            is_skipped: false,
            is_focused: false,
            name: name,
            image: image,
            html: html,
            strategy: 0,
            chance: 0,
            player_value: 1,
            action_available: (row < 4),
        }

        table_cell.innerHTML = `
            <div class="potion_div" style="">
                <table>
                    <tr>
                        <td>
                            <img class="potion_icon" src="img/${image}.png" style="float: left; margin-right: 5px;">
                        </td>
                        <td style="vertical-align: top;">
                            <span style="color: #F4C430">${name}</span> <br>
                            ${html}
                        </td>
                    </tr>
                </table>
                <div style="padding-bottom: 2px;">
                    Value for player: <input type="text" name="name" size="3" value="1" onchange="boa_solver.recomputeDynamicProgramming(); boa_solver.updateFromEventSequence();">
                </div>
                <div style="float: left;">
                    Chance to get: 0.0%
                </div>
                <div style="float: right;">
                    <button class="btn btn-red btn-action" onclick="boa_solver.addEvent(${row}, ${col})">SKIP</button>
                </div>
                <div style="float: left;">
                    Strategy info
                </div>
            </div>
        `;

        var cell = this.cell(row, col);

        cell.addEventListener("mouseenter", () => {this.focusCell(row, col)});
        cell.addEventListener("mouseleave", () => {this.unfocusCells()});

        // update first time
        this.renderCell(row, col);
    }

    exportLinkWithQueryParam() {
        var arg_seq = [];

        arg_seq.push(document.getElementById("selectedstrategy").value);

        for (let row of [1,2,3,4]) {
            for (let col of [1,2,3,4]) {
                arg_seq.push(this.elixir_info[row][col].player_value);
            }
        }

        for (let ev of this.event_sequence) {
            if (ev.is_focus_event) continue;

            arg_seq.push(ev.row | (ev.col << 4));
        }

        // apply
        const URL = "https://atstng.github.io/BrotherhoodOfAlchemistsSolver/index.html";
        var arg = arg_seq.map((a) => `${a}`).join("_");
        var result = `${URL}?a=${arg}`;

        navigator.clipboard.writeText(result).then(() => {
            console.log('[CLIPBOARD] copy successful: ' + arg);
          },() => {
            alert('Failed to copy to clipboard. Link: ' + arg);
          });
    }

    setFromQueryParam() {
        const url_params = new URLSearchParams(window.location.search);

        if (!url_params.has('a')) return;

        var a = url_params.get('a').split('_').map((x) => parseFloat(x));
        var pos = 0;

        // strategy selector
        document.getElementById("selectedstrategy").value = (a[pos] ? a[pos] : 0);
        pos++;

        // elixir player values
        for (let row of [1, 2, 3, 4]) {
            for (let col of [1, 2, 3, 4]) {
                if (a[pos] === undefined) continue;

                var cell = this.cell(row, col);
                var player_value_input = cell.children[1].children[0];

                var value = parseFloat(a[pos]);
                if (Number.isNaN(value)) value = 1;

                player_value_input.value = value;
                
                pos++;
            }
        }

        // events
        while (pos < a.length) {
            var encoded_event = parseInt(a[pos]);
            var ev_row = (encoded_event & ((1 << 4) - 1));
            var ev_col = (encoded_event >> 4);

            this.addEvent(ev_row, ev_col);
            
            pos++;
        }

        this.recomputeDynamicProgramming();
        this.updateFromEventSequence();
    }
}

document.getElementById("expanddescbtn").addEventListener("click", function() {
    document.getElementById("expanddesccontainer").style.display = "none";
    document.getElementById("fulldesccontainer").style.display = "block";
});

var boa_solver = new BrotherhoodOfAlchemistsSolver();
boa_solver.setFromQueryParam();

