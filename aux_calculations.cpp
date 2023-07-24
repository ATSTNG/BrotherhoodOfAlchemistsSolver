#include <bits/stdc++.h>

using namespace std;

const int OPEN = 0;
const int SKIPPED = 1;
const int ACQUIRED = 2;

const int STATE_SPACE = (3*3*3) * (3*3*3) * (3*3*3) * (3*3*3) * 5;

vector<int> graph[STATE_SPACE];
int paths[STATE_SPACE];
set<int> possible_outcomes;
int possible_paths = 0;
int reached_states = 0;

struct state {
    array<int, 12> e;
    int last_a;

    state(int v=0) {
        unpack(v);
    }

    void unpack(int v) {
        last_a = v % 5; v /= 5;

        for (int i = 0; i < e.size(); i++) {
            e[i] = v % 3; v /= 3;
        }

        assert(v == 0);
    }

    int pack() {
        int v = 0;

        for (int i = e.size()-1; i >= 0; i--) {
            v = v*3 + e[i];
        }
        v = v*5 + last_a;

        return v;
    }

    int as_player_outcome() {
        int v = 0;

        for (int i = e.size()-1; i >= 0; i--) {
            v = v*3 + (e[i] == ACQUIRED ? ACQUIRED : OPEN);
        }
        v = v*5 + last_a;

        return v;
    }

    int finished_alch() {
        int result = 0;

        for (int alch : {1,2,3,4}) {
            int finished_elixirs = 0;

            for (int ei : {3*(alch-1)+0, 3*(alch-1)+1, 3*(alch-1)+2}) {
                if (e[ei] != OPEN) finished_elixirs++;
            }

            if (finished_elixirs == 3) result = alch;
        }

        return result;
    }

    bool is_finished() {
        return finished_alch() != 0;
    }

    int rank() {
        int result = 0;

        for (auto elixir : e) {
            if (elixir != OPEN) result++;
        }

        return result;
    }

    bool is_skip_step() {
        return rank() % 2 == 1;
    }

    bool is_acquire_step() {
        return rank() % 2 == 0;
    }

    int elixir_to_alch(int ei) {
        return ei/3 + 1;
    }

    optional<state> add_elixir(int ei) {
        state result(this->pack());

        if (is_finished()) return nullopt;
        if (e[ei] != OPEN) return nullopt;
        if (last_a == elixir_to_alch(ei)) return nullopt;

        result.e[ei] = (is_skip_step() ? SKIPPED : ACQUIRED);
        result.last_a = (is_skip_step() ? 0 : elixir_to_alch(ei));

        return result;
    }

    string debug() {
        stringstream ss;

        ss << "state ";

        ss << "e=";
        for (int ei = 0; ei < 12; ei++) {
            if (ei > 0 && ei%3 == 0) ss << ".";
            ss << e[ei];
        }
        ss << " ";

        ss << "last_a=" << last_a << " ";
        ss << "pack=" << pack() << "";

        return ss.str();
    }

};

int main() {
    /// compute
    paths[0] = 1;
    for (int sp = 0; sp < STATE_SPACE; sp++) {
        if (paths[sp] == 0) continue; // skip unreachable
        state s(sp);

        reached_states += 1;
        if (s.is_finished()) {
            possible_paths += paths[sp];
            possible_outcomes.insert(s.as_player_outcome());
        }

        for (int ei = 0; ei < 12; ei++) {
            optional<state> new_state = s.add_elixir(ei);

            if ( !new_state) continue;

            int nsp = new_state.value().pack();

            paths[nsp] += paths[sp];
            graph[sp].push_back(nsp);
        }
    }

    /// test
    for (int sp = 0; sp < STATE_SPACE; sp++) {
        state s(sp);

        assert(s.pack() == sp);
    }

    vector<int> test_elixirs { 0,  3,  1,  4,  6,  9, 11, 2};
    vector<int> test_graph   {12,  9, 10,  8,  8,  5,  6, 4, 0};

    state s(0);
    int test_step = 0;
    cout << "TEST step " << test_step << " => " << s.debug() << "\n";

    for (int i = 0; i < test_elixirs.size(); i++) {
        assert(graph[s.pack()].size() == test_graph[i]);

        optional<state> nso = s.add_elixir(test_elixirs[i]);
        assert(nso.has_value());
        s = nso.value();
        test_step++;

        assert(graph[s.pack()].size() == test_graph[i+1]);

        cout << "TEST step " << test_step << " => " << s.debug() << "\n";
    }
    assert(s.finished_alch() == 1);
    cout << "\n";

    /// output
    cout << "state space size: " << STATE_SPACE << "\n";
    cout << "reached_states: " << reached_states << "\n";
    cout << "possible_paths: " << possible_paths << "\n";
    cout << "possible_outcomes: " << possible_outcomes.size() << "\n";

}
