s = open('24.txt').read().strip()
k = m = 0
for c in s:
    if c == 'A':
        k += 1
    else:
        k = 0
    m = max(m, k)
print(m)