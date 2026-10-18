"""Static bot parameters per difficulty.

The hard profile was tuned offline by self-play search (balance/tune.py) and
frozen here — bots never call an AI model at runtime.
"""

PARAMS = {
    "easy": {
        "mode": "easy",
        "pass_prob": 0.25,     # chance to just pass a turn
        "noise": 10.0,         # std-dev of noise added to its read of each company
        "buy_frac_min": 0.3,   # invests a random 30-100% of cash per buy
        "loan_prob": 0.5,      # chance to cash a Loan Stock when it has one
        "power_prob": 0.3,     # chance to fire a Rights Issue / Debenture
        "sell_prob": 0.5,      # chance to dump a company its cards say will fall
    },
    "medium": {
        "mode": "ev",
        "particles": 0,        # 0 = reason from the closed-form expectation only
        "ply": 1,
        "roles": False,
        "infer": False,
        "beta": 0.0,
        "risk": 0.0,
        "rel": 0.0,
        "k_chair": 0.0,
        "k_dir": 0.0,
        "suspend_rel": 0.0,
        "catchup": 0.0,
        "half": False,
    },
    "hard": {
        # Weights below: cross-entropy self-play search, 8 generations x 12
        # candidates x 240 games (balance/tune.py, results/tune_log.json).
        "mode": "ev",
        "particles": 96,
        "ply": 2,
        "roles": True,
        "infer": True,
        "beta": 0.388,         # how much opponents' buys/sells shift beliefs about their cards
        "risk": 0.121,         # penalty per unit of end-of-day stdev
        "rel": 0.347,          # weight on what a Rights Issue / Debenture gifts opponents
        "k_chair": 0.271,      # future value per share per remaining day of a chairman seat
        "k_dir": 0.365,        # ... per director discard
        "suspend_rel": 0.449,  # Share Suspend: weight on hurting the best opponent
        "catchup": 0.298,      # risk appetite added when trailing in the last 3 days
        "half": True,
    },
}
