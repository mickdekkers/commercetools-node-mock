import type {
	ChannelReference,
	ChannelResourceIdentifier,
	Store,
	StoreDraft,
	StoreSetCountriesAction,
	StoreSetCustomFieldAction,
	StoreSetCustomTypeAction,
	StoreSetDistributionChannelsAction,
	StoreSetLanguagesAction,
	StoreSetNameAction,
	StoreUpdateAction,
} from "@commercetools/platform-sdk";
import { getBaseResourceProperties } from "../helpers";
import { AbstractStorage } from "../storage/abstract";
import type { Writable } from "../types";
import {
	AbstractResourceRepository,
	AbstractUpdateHandler,
	RepositoryContext,
	UpdateHandlerInterface,
} from "./abstract";
import {
	createCustomFields,
	getReferenceFromResourceIdentifier,
} from "./helpers";

export class StoreRepository extends AbstractResourceRepository<"store"> {
	constructor(storage: AbstractStorage) {
		super("store", storage);
		this.actions = new StoreUpdateHandler(this._storage);
	}

	create(context: RepositoryContext, draft: StoreDraft): Store {
		const resource: Store = {
			...getBaseResourceProperties(),
			key: draft.key,
			name: draft.name,
			languages: draft.languages ?? [],
			countries: draft.countries ?? [],
			distributionChannels: transformChannels(
				context,
				this._storage,
				draft.distributionChannels,
			),
			supplyChannels: transformChannels(
				context,
				this._storage,
				draft.supplyChannels,
			),
			productSelections: [],
			custom: createCustomFields(
				draft.custom,
				context.projectKey,
				this._storage,
			),
		};
		return this.saveNew(context, resource);
	}
}

const transformChannels = (
	context: RepositoryContext,
	storage: AbstractStorage,
	channels?: ChannelResourceIdentifier[],
) => {
	if (!channels) return [];

	return channels.map((ref) =>
		getReferenceFromResourceIdentifier<ChannelReference>(
			ref,
			context.projectKey,
			storage,
		),
	);
};

class StoreUpdateHandler
	extends AbstractUpdateHandler
	implements Partial<UpdateHandlerInterface<Store, StoreUpdateAction>>
{
	setName(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ name }: StoreSetNameAction,
	) {
		resource.name = name;
	}

	setDistributionChannels(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ distributionChannels }: StoreSetDistributionChannelsAction,
	) {
		resource.distributionChannels = transformChannels(
			context,
			this._storage,
			distributionChannels,
		);
	}

	setLanguages(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ languages }: StoreSetLanguagesAction,
	) {
		resource.languages = languages ?? [];
	}

	setCustomType(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ type, fields }: StoreSetCustomTypeAction,
	) {
		if (type) {
			resource.custom = createCustomFields(
				{ type, fields },
				context.projectKey,
				this._storage,
			);
		} else {
			resource.custom = undefined;
		}
	}

	setCustomField(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ name, value }: StoreSetCustomFieldAction,
	) {
		if (!resource.custom) {
			return;
		}
		if (value === null) {
			delete resource.custom.fields[name];
		} else {
			resource.custom.fields[name] = value;
		}
	}

	setCountries(
		context: RepositoryContext,
		resource: Writable<Store>,
		{ countries }: StoreSetCountriesAction,
	) {
		resource.countries = countries ?? [];
	}
}
