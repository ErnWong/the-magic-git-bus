FROM nixpkgs/nix-flakes AS builder
COPY . /app
WORKDIR /app
RUN nix build --option extra-substituters "https://cache.garnix.io" --option extra-trusted-public-keys "cache.garnix.io:CTFPyKSLcx5RMJKfLo5EEPUObbA78b0YQ2DTCJXqr9g=" .#

RUN mkdir /app/nix-store-closure
RUN cp -R $(nix-store ---query --requisites ./result) /app/nix-store-closure

FROM scratch

WORKDIR /app
COPY --from=builder /app/nix-store-closure /nix/store
COPY --from=builder /app/result /app/result
CMD ["/app/bin/the-magic-git-bus"]
