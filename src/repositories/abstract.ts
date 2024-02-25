import type {
	BaseResource,
	Project,
	QueryParam,
	ResourceNotFoundError,
	UpdateAction,
} from "@commercetools/platform-sdk";
import deepEqual from "deep-equal";
import { CommercetoolsError } from "~src/exceptions";
import { cloneObject } from "../helpers";
import { AbstractStorage } from "../storage";
import {
	ResourceMap,
	ResourceType,
	ShallowWritable,
	Writable,
} from "./../types";
import { checkConcurrentModification } from "./errors";

export type QueryParams = {
	expand?: string[];
	where?: string[];
	offset?: number;
	limit?: number;

	// Predicate var values. Should always start with `var.`
	[key: string]: QueryParam;
};

export type GetParams = {
	expand?: string[];
};

export type RepositoryContext = {
	projectKey: string;
	storeKey?: string;
};

export abstract class AbstractRepository<R extends BaseResource | Project> {
	protected _storage: AbstractStorage;

	protected actions: AbstractUpdateHandler | undefined;

	constructor(storage: AbstractStorage) {
		this._storage = storage;
	}

	abstract saveNew({ projectKey }: RepositoryContext, resource: R): void;

	abstract saveUpdate(
		{ projectKey }: RepositoryContext,
		version: number,
		resource: R,
	): void;

	processUpdateActions(
		context: RepositoryContext,
		resource: R,
		version: number,
		actions: UpdateAction[],
	): R {
		if (!this.actions) {
			throw new Error("No actions defined");
		}

		const updatedResource = this.actions.apply(
			context,
			resource,
			version,
			actions,
		);

		// If all actions succeeded we write the new version
		// to the storage.
		if (resource.version != updatedResource.version) {
			this.saveUpdate(context, version, updatedResource);
		}

		const result = this.postProcessResource(updatedResource);
		if (!result) {
			throw new Error("invalid post process action");
		}
		return result;
	}

	abstract postProcessResource(resource: any): any;
}

export abstract class AbstractResourceRepository<
	T extends ResourceType,
> extends AbstractRepository<ResourceMap[T]> {
	protected _typeId: T;

	constructor(typeId: T, storage: AbstractStorage) {
		super(storage);
		this._typeId = typeId;
	}

	abstract create(context: RepositoryContext, draft: any): ResourceMap[T];

	protected getTypeId(): T {
		return this._typeId;
	}

	postProcessResource(resource: ResourceMap[T]): ResourceMap[T] {
		return resource;
	}

	query(context: RepositoryContext, params: QueryParams = {}) {
		const result = this._storage.query(context.projectKey, this.getTypeId(), {
			...params,
		});

		// @ts-ignore
		result.results = result.results.map(this.postProcessResource);
		return result;
	}

	get(
		context: RepositoryContext,
		id: string,
		params: GetParams = {},
	): ResourceMap[T] | null {
		const resource = this._storage.get(
			context.projectKey,
			this.getTypeId(),
			id,
			params,
		);
		return resource ? this.postProcessResource(resource) : null;
	}

	getByKey(
		context: RepositoryContext,
		key: string,
		params: GetParams = {},
	): ResourceMap[T] | null {
		const resource = this._storage.getByKey(
			context.projectKey,
			this.getTypeId(),
			key,
			params,
		);
		return resource ? this.postProcessResource(resource) : null;
	}

	delete(
		context: RepositoryContext,
		id: string,
		params: GetParams = {},
	): ResourceMap[T] | null {
		const resource = this._storage.delete(
			context.projectKey,
			this.getTypeId(),
			id,
			params,
		);
		return resource ? this.postProcessResource(resource) : null;
	}

	saveNew(
		context: RepositoryContext,
		resource: ShallowWritable<ResourceMap[T]>,
	): ResourceMap[T] {
		resource.version = 1;
		return this._storage.add(
			context.projectKey,
			this.getTypeId(),
			resource as any,
		);
	}

	saveUpdate(
		context: RepositoryContext,
		version: number,
		resource: ShallowWritable<ResourceMap[T]>,
	) {
		// Check if the resource still exists.
		const current = this._storage.get(
			context.projectKey,
			this.getTypeId(),
			resource.id,
		);
		if (!current) {
			throw new CommercetoolsError<ResourceNotFoundError>(
				{
					code: "ResourceNotFound",
					message: "Resource not found while updating",
				},
				400,
			);
		}

		checkConcurrentModification(current.version, version, resource.id);

		if (current.version === resource.version) {
			throw new Error("Internal error: no changes to save");
		}
		resource.lastModifiedAt = new Date().toISOString();

		this._storage.add(context.projectKey, this.getTypeId(), resource as any);

		return resource;
	}
}

type UpdateActionHandlerMethod<A, T> = (
	context: RepositoryContext,
	resource: Writable<A>,
	action: T,
) => void;

export type UpdateHandlerInterface<
	A extends BaseResource | Project,
	T extends UpdateAction,
> = {
	[P in T as P["action"]]: UpdateActionHandlerMethod<A, P>;
};

export class AbstractUpdateHandler {
	constructor(protected _storage: AbstractStorage) {
		if (!_storage) {
			throw new Error("No storage provided");
		}
		this._storage = _storage;
	}

	apply<R extends BaseResource | Project>(
		context: RepositoryContext,
		resource: R,
		version: number,
		actions: UpdateAction[],
	): R {
		const updatedResource = cloneObject(resource) as ShallowWritable<R>;
		const identifier = (resource as BaseResource).id
			? (resource as BaseResource).id
			: (resource as Project).key;

		for (const action of actions) {
			// @ts-ignore
			const updateFunc = this[action.action].bind(this);

			if (!updateFunc) {
				console.error(`No mock implemented for update action ${action.action}`);
				throw new Error(
					`No mock implemented for update action ${action.action}`,
				);
			}

			const beforeUpdate = cloneObject(resource);
			updateFunc(context, updatedResource, action);

			// Check if the object is updated. We need to increase the version of
			// an object per action which does an actual modification.
			// This isn't the most performant method to do this (the update action
			// should return a flag) but for now the easiest.
			if (!deepEqual(beforeUpdate, updatedResource)) {
				// We only check the version when there is an actual modification to
				// be stored.
				checkConcurrentModification(resource.version, version, identifier);

				updatedResource.version += 1;
			}
		}
		return updatedResource;
	}
}
