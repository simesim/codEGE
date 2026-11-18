s = open('24.txt').read().strip()
K = 5
l = k = m = 0
for r in range(len(s)):
    if s[r] == 'A':
        k += 1
    while k > K:
        if s[l] == 'A':
            k -= 1
        l += 1
    if k == K:
        m = max(m, r-l+1)
print(m)