# start
git checkout main
git pull origin main
git checkout -b feature/x

# work
git add .
git commit -m "x"
git push -u origin feature/x

# PR → merge on GitHub  

# AFTER merge
git checkout main
git pull origin main
git branch -d feature/x