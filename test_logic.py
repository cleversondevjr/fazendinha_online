
import sys

def test_water_logic():
    print("Testing Water Logic...")
    # Simulate slots 0-5 (max 2 waters)
    # Simulate slots 6-7 (max 4 waters)
    # Each water = 2 hours

    def calculate_new_expiry(current_expiry, now, count, max_waters):
        duration = 2 * 3600 # 2 hours in seconds
        start = max(current_expiry, now)
        new_expiry = start + duration
        if new_expiry > now + (max_waters * duration):
            return None # Error limit reached
        return new_expiry

    now = 10000
    # Slot 0
    e1 = calculate_new_expiry(0, now, 1, 2)
    print(f"Slot 0 - Water 1: {e1} (Expected 17200)") # 10000 + 7200
    e2 = calculate_new_expiry(e1, now, 2, 2)
    print(f"Slot 0 - Water 2: {e2} (Expected 24400)") # 17200 + 7200
    e3 = calculate_new_expiry(e2, now, 3, 2)
    print(f"Slot 0 - Water 3: {e3} (Expected None - Limit 2)")

    # Slot 6
    s1 = calculate_new_expiry(0, now, 1, 4)
    s2 = calculate_new_expiry(s1, now, 2, 4)
    s3 = calculate_new_expiry(s2, now, 3, 4)
    s4 = calculate_new_expiry(s3, now, 4, 4)
    s5 = calculate_new_expiry(s4, now, 5, 4)
    print(f"Slot 6 - Water 4: {s4} (Expected 38800)")
    print(f"Slot 6 - Water 5: {s5} (Expected None - Limit 4)")

def test_password_validation():
    print("\nTesting Password Validation...")
    import re
    regex = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,24}$"

    passwords = {
        "short": False,
        "NoSpecial1": False,
        "nonumber": False,
        "NOLOWERA1!": False,
        "nouppera1!": False,
        "ValidPass1!": True,
        "ThisIsAVeryLongPasswordThatExceedsLimit123!": False
    }

    for pwd, expected in passwords.items():
        res = bool(re.match(regex, pwd))
        print(f"PWD: {pwd[:10]}... | Match: {res} | Expected: {expected}")
        assert res == expected

if __name__ == "__main__":
    test_water_logic()
    test_password_validation()
    print("\nLogic checks passed!")
