.PHONY: install start test typecheck known-failure pdf

install:
	npm ci

start:
	npm start

test:
	npm test

typecheck:
	npm run typecheck

known-failure:
	npm run test:known-failure

pdf:
	npm run pdf
